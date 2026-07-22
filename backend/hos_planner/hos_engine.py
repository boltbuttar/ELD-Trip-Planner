import requests
import time
from datetime import datetime, timedelta

class HOSTripPlanner:
    # ── FMCSA HOS Regulations (Property-Carrying, 70hr/8-day) ──────────────────
    MAX_DRIVING_HOURS        = 11.0    # §395.3(a)(3) – max driving per duty period
    MAX_DUTY_WINDOW_HOURS    = 14.0    # §395.3(a)(2) – 14-hr driving window
    REQUIRED_REST_HOURS      = 10.0    # §395.3(a)(1) – 10 consecutive hours off
    BREAK_AFTER_DRIVING_HOURS = 8.0   # §395.3(a)(3)(ii) – break after 8 cumulative hrs
    BREAK_DURATION_HOURS     = 0.5    # 30-minute required break
    MAX_CYCLE_HOURS          = 70.0   # §395.3(b) – 70hr/8-day limit
    FUEL_STOP_MILES          = 1000.0  # Assumption: fuel every 1,000 miles
    FUEL_STOP_DURATION_HOURS = 0.5    # 30-min fuel stop
    PICKUP_DURATION_HOURS    = 1.0    # Assumption: 1 hour for pickup
    DROPOFF_DURATION_HOURS   = 1.0    # Assumption: 1 hour for dropoff
    AVERAGE_SPEED_MPH        = 55.0   # Average highway speed

    def __init__(self):
        self.headers = {'User-Agent': 'SpotterELDApp/1.0 (contact@spotter.app)'}

    # ── External API helpers ────────────────────────────────────────────────────

    def geocode(self, location_str):
        """Convert a location string to (lat, lon) using Nominatim."""
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': location_str, 'format': 'json', 'limit': 1}
        response = requests.get(url, headers=self.headers, params=params, timeout=10)
        time.sleep(1)  # Nominatim rate limit: 1 request/sec
        if response.status_code == 200 and response.json():
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
        raise Exception(f"Geocoding failed for: {location_str}")

    def reverse_geocode(self, lat, lon):
        """Convert (lat, lon) to a human-readable location string."""
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {'lat': lat, 'lon': lon, 'format': 'json'}
        response = requests.get(url, headers=self.headers, params=params, timeout=10)
        time.sleep(1)
        if response.status_code == 200 and response.json():
            data = response.json()
            city = data.get('address', {}).get('city') or data.get('address', {}).get('town') or data.get('address', {}).get('village', '')
            state = data.get('address', {}).get('state', '')
            if city and state:
                return f"{city}, {state}"
            return data.get('display_name', 'En Route')[:40]
        return "En Route"

    def get_route(self, from_coord, to_coord):
        """Get route from OSRM. Returns (distance_miles, duration_hours, geometry)."""
        url = (f"https://router.project-osrm.org/route/v1/driving/"
               f"{from_coord[1]},{from_coord[0]};{to_coord[1]},{to_coord[0]}")
        params = {'overview': 'full', 'geometries': 'geojson'}
        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 200 and response.json().get('routes'):
            route = response.json()['routes'][0]
            distance_miles = route['distance'] / 1609.34
            duration_hours = route['duration'] / 3600.0
            return distance_miles, duration_hours, route['geometry']['coordinates']
        raise Exception("OSRM routing failed")

    def _interpolate_location(self, geometry, fraction):
        """Get coordinates at a fraction along the route geometry."""
        if not geometry or len(geometry) < 2:
            return (0.0, 0.0)
        fraction = max(0.0, min(1.0, fraction))
        idx = min(int(len(geometry) * fraction), len(geometry) - 1)
        lon, lat = geometry[idx]
        return lat, lon

    # ── Main planning function ──────────────────────────────────────────────────

    def plan_trip(self, current_location, pickup_location, dropoff_location, current_cycle_used=0.0):
        try:
            # 1. Geocode all locations
            curr_coord = self.geocode(current_location)
            pick_coord = self.geocode(pickup_location)
            drop_coord = self.geocode(dropoff_location)

            # 2. Get routing for both legs
            leg1_dist, leg1_dur, leg1_geom = self.get_route(curr_coord, pick_coord)
            leg2_dist, leg2_dur, leg2_geom = self.get_route(pick_coord, drop_coord)

            full_geometry = leg1_geom + leg2_geom
            total_dist    = leg1_dist + leg2_dist
            total_dur     = leg1_dur  + leg2_dur

            # 3. Set trip start time (8:00 AM today or tomorrow)
            start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
            if start_time < datetime.now():
                start_time += timedelta(days=1)

            # 4. Simulation state
            sim = {
                'current_time':             start_time,
                'driving_hours_in_period':  0.0,   # resets after 10-hr rest
                'duty_window_start':        start_time,
                'hours_since_last_break':   0.0,   # resets after any >=30min non-driving
                'cycle_hours_used':         float(current_cycle_used),
                'miles_since_fuel':         0.0,
                'total_miles_driven':       0.0,
                'events':                   [],
                'stops':                    [],
                'current_coord':            curr_coord,
                'last_location_name':       current_location,
            }

            # 5. Record the start stop
            sim['stops'].append({
                'type': 'start',
                'location': {'lat': curr_coord[0], 'lng': curr_coord[1]},
                'name': current_location,
                'arrival_time': start_time.isoformat()
            })

            # ── Helper: add an event to timeline ─────────────────────────────
            def add_event(type_str, duration_hrs, loc_name, desc, miles_driven=0.0):
                if duration_hrs <= 0:
                    return
                end_time = sim['current_time'] + timedelta(hours=duration_hrs)
                sim['events'].append({
                    'type':           type_str,
                    'start_time':     sim['current_time'],
                    'end_time':       end_time,
                    'location':       loc_name,
                    'description':    desc,
                    'duration_hours': duration_hrs,
                    'miles_driven':   miles_driven
                })
                sim['current_time'] = end_time
                sim['last_location_name'] = loc_name

                # ── Cycle hour accumulation (excludes off_duty & sleeper_berth) ──
                ON_DUTY_TYPES = {'driving', 'on_duty_not_driving', 'pickup',
                                 'dropoff', 'break', 'fueling'}
                if type_str in ON_DUTY_TYPES:
                    sim['cycle_hours_used'] += duration_hrs

                # ── Driving-specific counters ──────────────────────────────────
                if type_str == 'driving':
                    sim['driving_hours_in_period'] += duration_hrs
                    sim['hours_since_last_break']  += duration_hrs
                    sim['miles_since_fuel']        += miles_driven
                    sim['total_miles_driven']      += miles_driven

                # ── Reset break timer for any non-driving period >= 30 min ──
                # Per §395.3(a)(3)(ii): break = consecutive 30-min non-driving
                NON_DRIVING = {'on_duty_not_driving', 'off_duty', 'sleeper_berth',
                               'pickup', 'dropoff', 'break', 'fueling'}
                if type_str in NON_DRIVING and duration_hrs >= self.BREAK_DURATION_HOURS:
                    sim['hours_since_last_break'] = 0.0

                # ── Rest period resets (10+ hr off = new driving window) ──────
                if type_str in ('sleeper_berth', 'off_duty') and duration_hrs >= self.REQUIRED_REST_HOURS:
                    sim['driving_hours_in_period'] = 0.0
                    sim['duty_window_start']       = sim['current_time']
                    sim['hours_since_last_break']  = 0.0

                # ── 34-hour restart resets cycle ──────────────────────────────
                if type_str in ('sleeper_berth', 'off_duty') and duration_hrs >= 34.0:
                    sim['cycle_hours_used'] = 0.0

            # Pre-trip inspection (15 min)
            add_event('on_duty_not_driving', 0.25, current_location, 'Pre-trip inspection')

            # ── Drive segment helper ──────────────────────────────────────────
            def drive_segment(distance, duration, geom, dest_name, dest_coord):
                remaining_dist = distance
                remaining_dur  = duration

                while remaining_dur > 0.001:
                    # ── 1. Check 70hr/8-day cycle limit ──────────────────────
                    if sim['cycle_hours_used'] >= self.MAX_CYCLE_HOURS:
                        loc = sim['last_location_name']
                        add_event('off_duty', 34.0, loc, '34-hour restart (cycle limit reached)')
                        continue

                    # ── 2. Check 14-hr window & 11-hr driving limit ───────────
                    time_in_duty = (sim['current_time'] - sim['duty_window_start']).total_seconds() / 3600.0
                    driving_exhausted = sim['driving_hours_in_period'] >= self.MAX_DRIVING_HOURS
                    window_exhausted  = time_in_duty >= self.MAX_DUTY_WINDOW_HOURS

                    if driving_exhausted or window_exhausted:
                        loc = self.reverse_geocode(*sim['current_coord'])
                        sim['stops'].append({
                            'type': 'rest',
                            'location': {'lat': sim['current_coord'][0], 'lng': sim['current_coord'][1]},
                            'name': loc,
                            'arrival_time': sim['current_time'].isoformat(),
                            'duration_hours': self.REQUIRED_REST_HOURS
                        })
                        add_event('sleeper_berth', self.REQUIRED_REST_HOURS, loc, '10-hour sleeper berth rest')
                        continue

                    # ── 3. Check 30-min break (after 8 cumulative driving hrs) ─
                    if sim['hours_since_last_break'] >= self.BREAK_AFTER_DRIVING_HOURS:
                        loc = self.reverse_geocode(*sim['current_coord'])
                        sim['stops'].append({
                            'type': 'break',
                            'location': {'lat': sim['current_coord'][0], 'lng': sim['current_coord'][1]},
                            'name': loc,
                            'duration_hours': self.BREAK_DURATION_HOURS
                        })
                        add_event('on_duty_not_driving', self.BREAK_DURATION_HOURS, loc,
                                  '30-minute break (§395.3(a)(3)(ii))')
                        continue

                    # ── 4. Check fuel stop (every 1,000 miles) ────────────────
                    if sim['miles_since_fuel'] >= self.FUEL_STOP_MILES:
                        loc = self.reverse_geocode(*sim['current_coord'])
                        sim['stops'].append({
                            'type': 'fuel',
                            'location': {'lat': sim['current_coord'][0], 'lng': sim['current_coord'][1]},
                            'name': loc,
                            'duration_hours': self.FUEL_STOP_DURATION_HOURS
                        })
                        add_event('on_duty_not_driving', self.FUEL_STOP_DURATION_HOURS, loc, 'Fuel stop')
                        sim['miles_since_fuel'] = 0.0
                        continue

                    # ── 5. Calculate how long we can drive right now ──────────
                    driving_hrs_left  = self.MAX_DRIVING_HOURS - sim['driving_hours_in_period']
                    window_hrs_left   = self.MAX_DUTY_WINDOW_HOURS - time_in_duty
                    break_hrs_left    = self.BREAK_AFTER_DRIVING_HOURS - sim['hours_since_last_break']
                    cycle_hrs_left    = self.MAX_CYCLE_HOURS - sim['cycle_hours_used']
                    miles_to_fuel     = self.FUEL_STOP_MILES - sim['miles_since_fuel']
                    fuel_hrs_left     = max(0.1, miles_to_fuel / self.AVERAGE_SPEED_MPH)

                    drive_time = min(
                        driving_hrs_left,
                        window_hrs_left,
                        break_hrs_left,
                        fuel_hrs_left,
                        cycle_hrs_left,
                        remaining_dur
                    )

                    # Safety guard against floating-point edge cases
                    if drive_time < 0.001:
                        drive_time = 0.001

                    if drive_time > remaining_dur:
                        drive_time = remaining_dur

                    # Calculate proportional distance
                    drive_dist = (drive_time / remaining_dur) * remaining_dist if remaining_dur > 0 else 0

                    add_event('driving', drive_time,
                              f'En route to {dest_name}',
                              f'Driving towards {dest_name}',
                              drive_dist)

                    remaining_dur  -= drive_time
                    remaining_dist -= drive_dist

                    # Update current coordinate along route geometry
                    fraction = 1.0 - (remaining_dist / max(distance, 0.001))
                    sim['current_coord'] = self._interpolate_location(geom, fraction)

                sim['current_coord'] = dest_coord

            # ── Execute the trip ──────────────────────────────────────────────

            # Leg 1: Current → Pickup
            drive_segment(leg1_dist, leg1_dur, leg1_geom, pickup_location, pick_coord)

            # Pickup (1 hour on-duty)
            sim['stops'].append({
                'type': 'pickup',
                'location': {'lat': pick_coord[0], 'lng': pick_coord[1]},
                'name': pickup_location,
                'arrival_time':   sim['current_time'].isoformat(),
                'departure_time': (sim['current_time'] + timedelta(hours=self.PICKUP_DURATION_HOURS)).isoformat(),
                'duration_hours': self.PICKUP_DURATION_HOURS
            })
            add_event('on_duty_not_driving', self.PICKUP_DURATION_HOURS,
                      pickup_location, 'Loading / Pickup (1 hour)')

            # Leg 2: Pickup → Dropoff
            drive_segment(leg2_dist, leg2_dur, leg2_geom, dropoff_location, drop_coord)

            # Dropoff (1 hour on-duty)
            sim['stops'].append({
                'type': 'dropoff',
                'location': {'lat': drop_coord[0], 'lng': drop_coord[1]},
                'name': dropoff_location,
                'arrival_time':   sim['current_time'].isoformat(),
                'departure_time': (sim['current_time'] + timedelta(hours=self.DROPOFF_DURATION_HOURS)).isoformat(),
                'duration_hours': self.DROPOFF_DURATION_HOURS
            })
            add_event('on_duty_not_driving', self.DROPOFF_DURATION_HOURS,
                      dropoff_location, 'Unloading / Dropoff (1 hour)')

            # Post-trip inspection
            add_event('on_duty_not_driving', 0.25, dropoff_location, 'Post-trip inspection')

            # ── Generate daily logs ───────────────────────────────────────────
            if not sim['events']:
                return {'error': 'No events generated'}

            daily_logs = []
            trip_start       = sim['events'][0]['start_time']
            current_day_start = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)

            day_num = 1
            idx = 0
            prev_day_last_location = current_location  # Track for From/To fields

            while idx < len(sim['events']):
                next_day_start = current_day_start + timedelta(days=1)
                day_events = []
                day_miles  = 0.0
                day_hours  = {'off_duty': 0.0, 'sleeper_berth': 0.0,
                               'driving': 0.0, 'on_duty_not_driving': 0.0}
                remarks         = []
                day_first_loc   = None
                day_last_loc    = None

                while idx < len(sim['events']):
                    evt = sim['events'][idx]
                    if evt['start_time'] >= next_day_start:
                        break  # Move to next day

                    # Determine how much of this event falls in today
                    if evt['end_time'] <= next_day_start:
                        # Entire event is in this day
                        dur = evt['duration_hours']
                        start_h = (evt['start_time'] - current_day_start).total_seconds() / 3600.0
                        end_h   = (evt['end_time']   - current_day_start).total_seconds() / 3600.0

                        day_events.append({
                            'type':        evt['type'],
                            'start_hour':  round(max(0, start_h), 4),
                            'end_hour':    round(min(24, end_h),   4),
                            'description': evt['description'],
                            'location':    evt['location']
                        })

                        cat = evt['type']
                        if cat in ('pickup', 'dropoff', 'fueling', 'break'):
                            cat = 'on_duty_not_driving'
                        if cat in day_hours:
                            day_hours[cat] += dur
                        day_miles += evt['miles_driven']

                        remarks.append({
                            'time':     evt['start_time'].strftime('%H:%M'),
                            'location': evt['location'],
                            'status':   evt['type']
                        })

                        if day_first_loc is None:
                            day_first_loc = evt['location']
                        day_last_loc = evt['location']
                        idx += 1

                    else:
                        # Event spans midnight — split it
                        dur_today = (next_day_start - evt['start_time']).total_seconds() / 3600.0
                        dur_next  = (evt['end_time'] - next_day_start).total_seconds() / 3600.0
                        frac      = dur_today / max(evt['duration_hours'], 0.001)
                        miles_today = evt['miles_driven'] * frac

                        start_h = (evt['start_time'] - current_day_start).total_seconds() / 3600.0
                        day_events.append({
                            'type':        evt['type'],
                            'start_hour':  round(max(0, start_h), 4),
                            'end_hour':    24.0,
                            'description': evt['description'],
                            'location':    evt['location']
                        })

                        cat = evt['type']
                        if cat in ('pickup', 'dropoff', 'fueling', 'break'):
                            cat = 'on_duty_not_driving'
                        if cat in day_hours:
                            day_hours[cat] += dur_today
                        day_miles += miles_today

                        remarks.append({
                            'time':     evt['start_time'].strftime('%H:%M'),
                            'location': evt['location'],
                            'status':   evt['type']
                        })

                        if day_first_loc is None:
                            day_first_loc = evt['location']
                        day_last_loc = evt['location']

                        # Update event for next day's processing
                        evt['start_time']     = next_day_start
                        evt['duration_hours'] = dur_next
                        evt['miles_driven']  -= miles_today
                        break

                # Fill remaining time as off-duty to complete 24 hours
                total_logged = sum(day_hours.values())
                if total_logged < 24.0:
                    day_hours['off_duty'] += (24.0 - total_logged)

                daily_logs.append({
                    'day_number':    day_num,
                    'date':          current_day_start.strftime('%Y-%m-%d'),
                    'events':        day_events,
                    'total_miles':   round(day_miles, 2),
                    'hours_summary': {k: round(v, 2) for k, v in day_hours.items()},
                    'remarks':       remarks,
                    'from_location': prev_day_last_location,
                    'to_location':   day_last_loc or dropoff_location
                })

                prev_day_last_location = day_last_loc or prev_day_last_location
                current_day_start = next_day_start
                day_num += 1

            # ── Build final response ──────────────────────────────────────────
            total_drive_hrs = sum(e['duration_hours'] for e in sim['events'] if e['type'] == 'driving')
            total_duty_hrs  = sum(e['duration_hours'] for e in sim['events']
                                   if e['type'] not in ('off_duty', 'sleeper_berth'))

            return {
                'route': {
                    'geometry':             full_geometry,
                    'total_distance_miles': round(total_dist, 2),
                    'total_duration_hours': round(total_dur,  2),
                    'legs': [
                        {
                            'from':           current_location,
                            'to':             pickup_location,
                            'distance_miles': round(leg1_dist, 2),
                            'duration_hours': round(leg1_dur,  2)
                        },
                        {
                            'from':           pickup_location,
                            'to':             dropoff_location,
                            'distance_miles': round(leg2_dist, 2),
                            'duration_hours': round(leg2_dur,  2)
                        }
                    ]
                },
                'stops':     sim['stops'],
                'daily_logs': daily_logs,
                'trip_summary': {
                    'total_miles':         round(sim['total_miles_driven'], 2),
                    'total_driving_hours': round(total_drive_hrs, 2),
                    'total_duty_hours':    round(total_duty_hrs,  2),
                    'total_days':          len(daily_logs),
                    'total_rest_stops':    len([s for s in sim['stops'] if s['type'] == 'rest']),
                    'total_fuel_stops':    len([s for s in sim['stops'] if s['type'] == 'fuel'])
                }
            }

        except Exception as e:
            import traceback
            return {'error': str(e), 'traceback': traceback.format_exc()}
