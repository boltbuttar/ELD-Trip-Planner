# 🚛 Spotter ELD Trip Planner

A full-stack FMCSA-compliant Electronic Logging Device (ELD) trip planning application built with **Django** (backend) and **React/Vite** (frontend).

## 🎯 Features

- **Route Planning** — Enter current location, pickup, and dropoff destinations; get a real map route via OSRM
- **HOS-Compliant Simulation** — Fully simulates FMCSA Hours of Service rules (70hr/8-day, 11hr driving, 14hr window, 30-min break, 10hr rest)
- **ELD Daily Log Sheets** — Generates official FMCSA Driver's Daily Log forms with the step-function status line drawn on the 24-hour grid
- **Multi-day Support** — Long trips automatically generate multiple log sheets
- **Interactive Map** — Leaflet map with color-coded stop markers (start, pickup, dropoff, fuel, rest, break)

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (custom design system) |
| Map | Leaflet.js + CartoDB Voyager tiles |
| Backend | Django 4.2 + Django REST Framework |
| Geocoding | Nominatim (OpenStreetMap) |
| Routing | OSRM (Project OSRM public API) |
| Deployment | Vercel (frontend) + Render (backend) |

## ⚖️ HOS Rules Implemented (FMCSA §395)

| Rule | Implementation |
|------|---------------|
| 11-hour driving limit | §395.3(a)(3) |
| 14-hour driving window | §395.3(a)(2) |
| 10-hour consecutive rest | §395.3(a)(1) |
| 30-min break after 8 cumulative driving hours | §395.3(a)(3)(ii) |
| 70hr/8-day cycle limit | §395.3(b) |
| 34-hour restart | §395.3(c) |
| Fuel stop every 1,000 miles | (Assumption) |
| 1 hour pickup + dropoff | (Assumption) |

## 🚀 Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate         # Windows
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

App runs at **http://localhost:5173**. API proxied to **http://localhost:8000**.

## 🌐 Deployment

### Frontend → Vercel
1. Push the `frontend/` folder to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Set root directory to `frontend`
4. Set build command: `npm run build`, output: `dist`
5. Add env var: `VITE_API_BASE_URL=https://your-backend.onrender.com`

### Backend → Render
1. Push the `backend/` folder to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
4. Start command: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
5. Set env vars:
   - `DJANGO_SECRET_KEY` = (random secret)
   - `DEBUG` = `False`
   - `ALLOWED_HOSTS` = `your-backend.onrender.com`

## 📋 API Reference

### `POST /api/plan-trip/`

**Request body:**
```json
{
  "current_location": "New York, NY",
  "pickup_location": "Chicago, IL",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_used": 0
}
```

**Response:**
```json
{
  "route": { "geometry": [...], "legs": [...] },
  "stops": [...],
  "daily_logs": [
    {
      "day_number": 1,
      "date": "2026-07-23",
      "events": [{ "type": "driving", "start_hour": 8.0, "end_hour": 19.0 }],
      "hours_summary": { "driving": 11.0, "on_duty_not_driving": 1.25, "sleeper_berth": 3.75, "off_duty": 8.0 },
      "remarks": [...],
      "from_location": "New York, NY",
      "to_location": "En Route"
    }
  ],
  "trip_summary": { "total_miles": 2800, "total_days": 3, ... }
}
```

## 📁 Project Structure

```
Spotter/
├── backend/
│   ├── backend/           # Django project settings
│   ├── hos_planner/
│   │   ├── hos_engine.py  # FMCSA HOS simulation engine
│   │   └── views.py       # API endpoints
│   ├── requirements.txt
│   ├── Procfile           # Render/Railway deployment
│   └── manage.py
└── frontend/
    ├── src/
    │   ├── App.jsx        # Main dashboard (3-panel layout)
    │   ├── components/
    │   │   ├── TripForm.jsx      # Input form
    │   │   ├── MapView.jsx       # Leaflet map
    │   │   ├── TripSummary.jsx   # Stats cards
    │   │   ├── EldLogSheet.jsx   # FMCSA log form (SVG grid)
    │   │   └── EldLogSheet.css   # Log form styles
    │   └── index.css      # Global design system
    ├── vercel.json        # Vercel deployment config
    └── vite.config.js
```
