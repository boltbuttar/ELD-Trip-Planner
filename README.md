# 🚛 Spotter ELD Trip Planner

<div align="center">

![Spotter ELD](https://img.shields.io/badge/Spotter-ELD%20Trip%20Planner-3b82f6?style=for-the-badge&logo=truck&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?style=for-the-badge&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FMCSA](https://img.shields.io/badge/FMCSA-Compliant-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

### 🌐 [**Live Demo →**](https://frontend-iota-blue-86.vercel.app)

A full-stack FMCSA-compliant Electronic Logging Device (ELD) trip planner.  
Enter your route and instantly get a live map + official Driver's Daily Log sheets.

</div>

---

## 📸 Features at a Glance

| Route Planning | ELD Daily Logs |
|---|---|
| Interactive Leaflet map with color-coded stops | Official FMCSA Driver's Daily Log forms |
| OSRM-powered route optimization | Step-function status line drawn on 24h grid |
| Pickup, dropoff, fuel & rest markers | Multi-day log generation for long trips |

---

## 🎯 What It Does

1. **Enter trip details** — current location, pickup, dropoff, and hours already used in your 70hr/8-day cycle
2. **Get a live map** — full route with color-coded markers for every stop (start 🟢, pickup 📦, dropoff 🏁, fuel ⛽, rest 🛏️, break ☕)
3. **Get FMCSA ELD logs** — official Driver's Daily Log sheets filled out automatically, one per day, with the status timeline drawn as a step-function line on the 24-hour grid

---

## ⚖️ HOS Rules Implemented (FMCSA §395)

| Rule | Limit | CFR Reference |
|------|-------|--------------|
| Driving limit | 11 hours/day | §395.3(a)(3) |
| Duty window | 14 hours | §395.3(a)(2) |
| Rest requirement | 10 consecutive hours | §395.3(a)(1) |
| Mandatory break | 30 min after 8 hrs driving | §395.3(a)(3)(ii) |
| Cycle limit | 70 hrs / 8 days | §395.3(b) |
| 34-hour restart | Resets cycle | §395.3(c) |
| Fuel stops | Every 1,000 miles (30 min) | Operational assumption |
| Pickup / Dropoff | 1 hour each | Operational assumption |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite |
| **Styling** | Vanilla CSS (custom design system) |
| **Map** | Leaflet.js + CartoDB Voyager tiles (free) |
| **Backend** | Django 4.2 + Django REST Framework |
| **Geocoding** | Nominatim (OpenStreetMap) — free |
| **Routing** | OSRM (Project OSRM public API) — free |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |

---

## 🌐 Live Links

| Resource | URL |
|----------|-----|
| 🚀 **Live App** | https://frontend-iota-blue-86.vercel.app |
| ⚙️ **Backend API** | https://spotter-eld-backend-arrv.onrender.com |
| 📦 **GitHub Repo** | https://github.com/boltbuttar/ELD-Trip-Planner |

> **Note:** The backend runs on Render's free tier and may take ~30-50 seconds to respond after a period of inactivity (cold start). This is normal — the loading spinner will show while it wakes up.

---

## 📋 API Reference

### `POST /api/plan-trip/`

**Request:**
```json
{
  "current_location": "New York, NY",
  "pickup_location": "Chicago, IL",
  "dropoff_location": "Nashville, TN",
  "current_cycle_used": 0
}
```

**Response:**
```json
{
  "route": { "geometry": [[lng, lat], ...], "legs": [...] },
  "stops": [
    { "type": "start", "name": "New York, NY", "lat": 40.71, "lng": -74.00 },
    { "type": "pickup", "name": "Chicago, IL", "duration_hours": 1.0 },
    ...
  ],
  "daily_logs": [
    {
      "day_number": 1,
      "date": "2026-07-24",
      "from_location": "New York, NY",
      "to_location": "En Route",
      "total_miles": 420.5,
      "hours_summary": { "driving": 11.0, "on_duty_not_driving": 1.25, "sleeper_berth": 3.75, "off_duty": 8.0 },
      "events": [
        { "type": "driving", "start_hour": 8.0, "end_hour": 19.0 },
        { "type": "rest", "start_hour": 19.0, "end_hour": 24.0 }
      ],
      "remarks": [...]
    }
  ],
  "trip_summary": {
    "total_miles": 1263.1,
    "total_days": 3,
    "total_driving_hours": 23.72,
    "total_rest_stops": 2,
    "total_fuel_stops": 1
  }
}
```

### `GET /api/health/`
Returns `{"status": "ok"}` — use to wake up the Render instance before planning a trip.

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173** — API calls are proxied to **http://localhost:8000**.

---

## 📁 Project Structure

```
ELD-Trip-Planner/
├── backend/
│   ├── backend/
│   │   ├── settings.py        # Django config (env-based SECRET_KEY, CORS)
│   │   ├── urls.py            # URL routing
│   │   └── wsgi.py
│   ├── hos_planner/
│   │   ├── hos_engine.py      # ⭐ Core FMCSA HOS simulation engine
│   │   └── views.py           # REST API endpoint
│   ├── requirements.txt       # Python dependencies
│   ├── Procfile               # Gunicorn start command
│   ├── build.sh               # Render build script
│   ├── render.yaml            # Render deployment config
│   └── manage.py
│
└── frontend/
    ├── src/
    │   ├── App.jsx             # Main dashboard (sidebar + map + log panel)
    │   ├── App.css             # Layout styles
    │   ├── index.css           # Design system (tokens, buttons, inputs)
    │   └── components/
    │       ├── TripForm.jsx    # Input form with quick presets
    │       ├── MapView.jsx     # Leaflet map with custom stop markers
    │       ├── TripSummary.jsx # Stat cards (miles, hours, stops)
    │       ├── EldLogSheet.jsx # ⭐ Official FMCSA log form (SVG grid)
    │       └── EldLogSheet.css # Log form styles
    ├── vercel.json             # Vercel routing + API proxy
    └── vite.config.js          # Dev server with API proxy
```

---

## 🔑 Key Implementation Details

### HOS Engine (`hos_engine.py`)
The simulation engine processes each leg of the trip minute-by-minute, enforcing:
- Break timer resets after **any** non-driving period ≥ 30 minutes
- 34-hour restart triggers when the 70-hour cycle is exceeded
- Fuel stops injected automatically every 1,000 miles
- All events tagged with location, start/end hours, and status type

### ELD Log Sheet (`EldLogSheet.jsx`)
Renders the official FMCSA Driver's Daily Log form:
- SVG-based 24-hour grid with 15-min and 30-min ruler tick marks
- Step-function path drawn in blue connecting all status changes
- Colored fills behind each status period (Off=gray, Sleeper=purple, Driving=blue, On Duty=green)
- All official form fields: date, miles, vehicle number, carrier, From/To, shipper, manifest number
- Remarks table with time and location entries
- 70hr/8-day recap section at the bottom

---

## 👨‍💻 Author

Built by **Furqan** for the Spotter Full Stack Developer Assessment.

---

<div align="center">
Made with ❤️ using Django + React
</div>
