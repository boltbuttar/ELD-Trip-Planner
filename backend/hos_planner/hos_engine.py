import requests
import time
from datetime import datetime, timedelta
from geopy.distance import geodesic

class HOSTripPlanner:
    # HOS Regulations (FMCSA Property-Carrying, 70hr/8day)
    MAX_DRIVING_HOURS = 11.0
    MAX_DUTY_WINDOW_HOURS = 14.0
    REQUIRED_REST_HOURS = 10.0
    BREAK_AFTER_DRIVING_HOURS = 8.0
    BREAK_DURATION_HOURS = 0.5
    MAX_CYCLE_HOURS = 70.0
    FUEL_STOP_MILES = 1000.0
    FUEL_STOP_DURATION_HOURS = 0.5
    PICKUP_DURATION_HOURS = 1.0
    DROPOFF_DURATION_HOURS = 1.0
    AVERAGE_SPEED_MPH = 55.0

    def __init__(self):
        self.headers = {'User-Agent': 'SpotterELDApp/1.0'}

    def geocode(self, location_str):
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': location_str, 'format': 'json', 'limit': 1}
        response = requests.get(url, headers=self.headers, params=params)
        time.sleep(1) # Rate limit
        if response.status_code == 200 and response.json():
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
        raise Exception(f"Geocoding failed for location: {location_str}")

    def reverse_geocode(self, lat, lon):
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {'lat': lat, 'lon': lon, 'format': 'json'}
        response = requests.get(url, headers=self.headers, params=params)
        time.sleep(1) # Rate limit
        if response.status_code == 200 and response.json():
            data = response.json()
            return data.get('display_name', 'Unknown Location')
        return "Unknown Location"

    def get_route(self, from_coord, to_coord):
        # OSRM expects lon,lat
        url = f"https://router.project-osrm.org/route/v1/driving/{from_coord[1]},{from_coord[0]};{to_coord[1]},{to_coord[0]}"
        params = {'overview': 'full', 'geometries': 'geojson'}
        response = requests.get(url, params=params)
        if response.status_code == 200 and response.json().get('routes'):
            route = response.json()['routes'][0]
            distance_miles = route['distance'] / 1609.34 # meters to miles
            duration_hours = route['duration'] / 3600.0 # seconds to hours
            return distance_miles, duration_hours, route['geometry']['coordinates']
        raise Exception("Routing failed")

    def _interpolate_location(self, geometry, fraction):
        if not geometry:
            return (0, 0)
        total_len = len(geometry) - 1
        idx = int(total_len * fraction)
        lon, lat = geometry[idx]
        return lat, lon

    def plan_trip(self, current_location, pickup_location, dropoff_location, current_cycle_used=0.0):
        try:
            curr_coord = self.geocode(current_location)
            pick_coord = self.geocode(pickup_location)
            drop_coord = self.geocode(dropoff_location)

            leg1_dist, leg1_dur, leg1_geom = self.get_route(curr_coord, pick_coord)
            leg2_dist, leg2_dur, leg2_geom = self.get_route(pick_coord, drop_coord)

            full_geometry = leg1_geom + leg2_geom
            total_dist = leg1_dist + leg2_dist
            total_dur = leg1_dur + leg2_dur

            start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
            if start_time < datetime.now():
                start_time += timedelta(days=1)
                
            sim = {
                'current_time': start_time,
                'driving_hours_in_period': 0.0,
                'duty_window_start': start_time,
                'hours_since_last_break': 0.0,
                'cycle_hours_used': current_cycle_used,
                'miles_since_fuel': 0.0,
                'total_miles_driven': 0.0,
                'events': [],
                'stops': [],
                'current_coord': curr_coord,
                'current_geom': leg1_geom + leg2_geom
            }

            sim['stops'].append({
                'type': 'start',
                'location': {'lat': curr_coord[0], 'lng': curr_coord[1]},
                'name': current_location,
                'arrival_time': sim['current_time'].isoformat()
            })

            def add_event(type_str, duration_hrs, loc_name, desc, miles_driven=0.0):
                end_time = sim['current_time'] + timedelta(hours=duration_hrs)
                sim['events'].append({
                    'type': type_str,
                    'start_time': sim['current_time'],
                    'end_time': end_time,
                    'location': loc_name,
                    'description': desc,
                    'duration_hours': duration_hrs,
                    'miles_driven': miles_driven
                })
                sim['current_time'] = end_time
                if type_str in ['driving', 'on_duty_not_driving', 'fueling', 'pickup', 'dropoff', 'break']:
                    sim['cycle_hours_used'] += duration_hrs
                if type_str == 'driving':
                    sim['driving_hours_in_period'] += duration_hrs
                    sim['hours_since_last_break'] += duration_hrs
                    sim['miles_since_fuel'] += miles_driven
                    sim['total_miles_driven'] += miles_driven
                if type_str == 'sleeper_berth' or type_str == 'off_duty':
                    if duration_hrs >= 10:
                        sim['driving_hours_in_period'] = 0.0
                        sim['duty_window_start'] = sim['current_time']
                        sim['hours_since_last_break'] = 0.0
                    if duration_hrs >= 34:
                        sim['cycle_hours_used'] = 0.0

            # Pre-trip
            add_event('on_duty_not_driving', 0.25, current_location, 'Pre-trip inspection')

            def drive_segment(distance, duration, geom, dest_name, dest_coord):
                remaining_dist = distance
                remaining_dur = duration
                
                while remaining_dur > 0:
                    # check cycle limits
                    if sim['cycle_hours_used'] >= self.MAX_CYCLE_HOURS:
                        add_event('off_duty', 34.0, 'En Route', '34-hour restart')
                        
                    # check duty window
                    time_in_duty = (sim['current_time'] - sim['duty_window_start']).total_seconds() / 3600.0
                    if time_in_duty >= self.MAX_DUTY_WINDOW_HOURS or sim['driving_hours_in_period'] >= self.MAX_DRIVING_HOURS:
                        loc_name = self.reverse_geocode(*sim['current_coord'])
                        sim['stops'].append({
                            'type': 'rest',
                            'location': {'lat': sim['current_coord'][0], 'lng': sim['current_coord'][1]},
                            'name': loc_name,
                            'duration_hours': self.REQUIRED_REST_HOURS
                        })
                        add_event('sleeper_berth', self.REQUIRED_REST_HOURS, loc_name, '10-hour rest')
                        continue

                    # check break
                    if sim['hours_since_last_break'] >= self.BREAK_AFTER_DRIVING_HOURS:
                        loc_name = self.reverse_geocode(*sim['current_coord'])
                        add_event('on_duty_not_driving', self.BREAK_DURATION_HOURS, loc_name, '30-minute break')
                        sim['hours_since_last_break'] = 0.0
                        continue

                    # check fuel
                    if sim['miles_since_fuel'] >= self.FUEL_STOP_MILES:
                        loc_name = self.reverse_geocode(*sim['current_coord'])
                        sim['stops'].append({
                            'type': 'fuel',
                            'location': {'lat': sim['current_coord'][0], 'lng': sim['current_coord'][1]},
                            'name': loc_name
                        })
                        add_event('on_duty_not_driving', self.FUEL_STOP_DURATION_HOURS, loc_name, 'Fuel stop')
                        sim['miles_since_fuel'] = 0.0
                        continue

                    drive_time_avail = min(
                        self.MAX_DRIVING_HOURS - sim['driving_hours_in_period'],
                        self.MAX_DUTY_WINDOW_HOURS - time_in_duty,
                        self.BREAK_AFTER_DRIVING_HOURS - sim['hours_since_last_break'],
                        (self.FUEL_STOP_MILES - sim['miles_since_fuel']) / self.AVERAGE_SPEED_MPH if sim['miles_since_fuel'] < self.FUEL_STOP_MILES else 0,
                        self.MAX_CYCLE_HOURS - sim['cycle_hours_used'],
                        remaining_dur
                    )
                    
                    if drive_time_avail <= 0.01:
                        # force a tiny advancement if stuck due to precision
                        drive_time_avail = 0.01
                    
                    if drive_time_avail > remaining_dur:
                        drive_time_avail = remaining_dur

                    drive_dist = drive_time_avail / remaining_dur * remaining_dist if remaining_dur > 0 else remaining_dist
                    
                    add_event('driving', drive_time_avail, 'Driving', f'Driving towards {dest_name}', drive_dist)
                    
                    remaining_dur -= drive_time_avail
                    remaining_dist -= drive_dist
                    
                    fraction = 1.0 - (remaining_dist / distance) if distance > 0 else 1.0
                    sim['current_coord'] = self._interpolate_location(geom, fraction)

                sim['current_coord'] = dest_coord

            # Drive leg 1
            drive_segment(leg1_dist, leg1_dur, leg1_geom, pickup_location, pick_coord)
            
            # Pickup
            sim['stops'].append({
                'type': 'pickup',
                'location': {'lat': pick_coord[0], 'lng': pick_coord[1]},
                'name': pickup_location,
                'arrival_time': sim['current_time'].isoformat(),
                'departure_time': (sim['current_time'] + timedelta(hours=self.PICKUP_DURATION_HOURS)).isoformat(),
                'duration_hours': self.PICKUP_DURATION_HOURS
            })
            add_event('on_duty_not_driving', self.PICKUP_DURATION_HOURS, pickup_location, 'Loading/Pickup')

            # Drive leg 2
            drive_segment(leg2_dist, leg2_dur, leg2_geom, dropoff_location, drop_coord)

            # Dropoff
            sim['stops'].append({
                'type': 'dropoff',
                'location': {'lat': drop_coord[0], 'lng': drop_coord[1]},
                'name': dropoff_location,
                'arrival_time': sim['current_time'].isoformat()
            })
            add_event('on_duty_not_driving', self.DROPOFF_DURATION_HOURS, dropoff_location, 'Unloading/Dropoff')

            # Generate daily logs
            daily_logs = []
            if not sim['events']:
                return {}

            trip_start = sim['events'][0]['start_time']
            current_day_start = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            day_num = 1
            idx = 0
            while idx < len(sim['events']):
                next_day_start = current_day_start + timedelta(days=1)
                day_events = []
                day_miles = 0.0
                day_hours = {'off_duty': 0.0, 'sleeper_berth': 0.0, 'driving': 0.0, 'on_duty_not_driving': 0.0}
                remarks = []

                while idx < len(sim['events']):
                    evt = sim['events'][idx]
                    if evt['start_time'] >= next_day_start:
                        break # goes to next day
                    
                    if evt['end_time'] <= next_day_start:
                        # fully in this day
                        day_events.append({
                            'start': evt['start_time'].isoformat(),
                            'end': evt['end_time'].isoformat(),
                            'type': evt['type'],
                            'location': evt['location']
                        })
                        
                        dur = evt['duration_hours']
                        cat = evt['type']
                        if cat in ['pickup', 'dropoff', 'fueling', 'break']:
                            cat = 'on_duty_not_driving'
                        day_hours[cat] += dur
                        day_miles += evt['miles_driven']
                        remarks.append({'time': evt['start_time'].strftime('%H:%M'), 'location': evt['location'], 'status': evt['type']})
                        idx += 1
                    else:
                        # split event
                        dur_this_day = (next_day_start - evt['start_time']).total_seconds() / 3600.0
                        dur_next_day = (evt['end_time'] - next_day_start).total_seconds() / 3600.0
                        
                        frac = dur_this_day / evt['duration_hours']
                        miles_this_day = evt['miles_driven'] * frac
                        
                        day_events.append({
                            'start': evt['start_time'].isoformat(),
                            'end': next_day_start.isoformat(),
                            'type': evt['type'],
                            'location': evt['location']
                        })
                        
                        cat = evt['type']
                        if cat in ['pickup', 'dropoff', 'fueling', 'break']:
                            cat = 'on_duty_not_driving'
                        day_hours[cat] += dur_this_day
                        day_miles += miles_this_day
                        remarks.append({'time': evt['start_time'].strftime('%H:%M'), 'location': evt['location'], 'status': evt['type']})
                        
                        # modify event for next day
                        evt['start_time'] = next_day_start
                        evt['duration_hours'] = dur_next_day
                        evt['miles_driven'] -= miles_this_day
                        break

                # Ensure remaining off-duty to make 24 hours
                total_day_hrs = sum(day_hours.values())
                if total_day_hrs < 24.0:
                    day_hours['off_duty'] += (24.0 - total_day_hrs)
                    
                daily_logs.append({
                    'day_number': day_num,
                    'date': current_day_start.strftime('%Y-%m-%d'),
                    'events': day_events,
                    'total_miles': round(day_miles, 2),
                    'hours_summary': {k: round(v, 2) for k, v in day_hours.items()},
                    'remarks': remarks
                })
                current_day_start = next_day_start
                day_num += 1

            total_drive_hrs = sum(e['duration_hours'] for e in sim['events'] if e['type'] == 'driving')
            total_duty_hrs = sum(e['duration_hours'] for e in sim['events'] if e['type'] not in ['off_duty', 'sleeper_berth'])

            return {
                'route': {
                    'geometry': full_geometry,
                    'total_distance_miles': round(total_dist, 2),
                    'total_duration_hours': round(total_dur, 2),
                    'legs': [
                        {'from': current_location, 'to': pickup_location, 'distance_miles': round(leg1_dist, 2), 'duration_hours': round(leg1_dur, 2)},
                        {'from': pickup_location, 'to': dropoff_location, 'distance_miles': round(leg2_dist, 2), 'duration_hours': round(leg2_dur, 2)}
                    ]
                },
                'stops': sim['stops'],
                'daily_logs': daily_logs,
                'trip_summary': {
                    'total_miles': round(sim['total_miles_driven'], 2),
                    'total_driving_hours': round(total_drive_hrs, 2),
                    'total_duty_hours': round(total_duty_hrs, 2),
                    'total_days': len(daily_logs),
                    'total_rest_stops': len([s for s in sim['stops'] if s['type'] == 'rest']),
                    'total_fuel_stops': len([s for s in sim['stops'] if s['type'] == 'fuel'])
                }
            }
        except Exception as e:
            return {"error": str(e)}

