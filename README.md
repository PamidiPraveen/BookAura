# BookAura — Gemini AI Ticket Booking (Flask + React + MongoDB)

## What's new in this version
- **Real device location**: browser GPS permission, reverse-geocoded to your city, shown on an OpenStreetMap marker. Manual city search as fallback.
- **Gemini-powered chatbot** (function calling) replaces the rule-based bot. The API key stays on the server.
- **Trending movies** (TMDB now-playing, India) with showtimes at your **nearest real cinemas** (OpenStreetMap).
- **Hotels / hostels / guest houses** near your real location (OpenStreetMap).
- **Bus search** (AbhiBus-style): only real Indian cities accepted (validated via OpenStreetMap), date required, results as cards, then seat selection.

## Data honesty (important)
| Data | Source |
|------|--------|
| Your location, city names, cinemas, hotels | **Real** (OpenStreetMap) |
| Trending movies, ratings, posters | **Real** (TMDB) |
| Showtimes, seat/room prices, room availability | **Simulated** (deterministic) |
| Bus operators, fares, timings, seats | **Simulated** (deterministic) |

No free public API provides live showtimes, room inventory or bus inventory. To make them real, replace `search_buses`, `trending_with_shows` and `stays_near` in `backend/services.py` with a partner API (AbhiBus / RedBus / BookMyShow / Booking.com affiliate).

## Keys (put them ONLY in backend/.env)
```
GEMINI_API_KEY=...   # https://aistudio.google.com/apikey
TMDB_API_KEY=...     # https://www.themoviedb.org/settings/api (free)  - OR -
OMDB_API_KEY=...     # https://www.omdbapi.com/apikey.aspx (free). Then edit backend/now_showing.txt
```
Never paste keys into chats or commit `.env`. Geolocation needs `localhost` or HTTPS.

## 1 — Backend Setup (Flask)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set MONGO_URI (default: mongodb://localhost:27017)

# Run
python app.py
# Flask API listens on http://localhost:5000
```

### MongoDB Atlas (optional)

Replace `MONGO_URI` in `.env` with your Atlas connection string:
```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/bookaura?retryWrites=true&w=majority
```

---

## 2 — Frontend Setup (React / Vite)

```bash
cd frontend

npm install

npm run dev
# Opens http://localhost:3000
# API calls to /api/* are proxied to http://localhost:5000
```

---

## 3 — Production Build

```bash
# Build React
cd frontend && npm run build
# Output: frontend/dist/

# Serve dist via Flask (optional — add static folder config)
# Or deploy frontend to Vercel / Netlify and backend to Render / Railway
```

---

## Default Test Account

| Field    | Value |
|----------|-------|
| Email    | joyboyluffy7203111@gmail.com |
| Password | password123 |

---

## What changed vs the original

| Layer | Original | Converted |
|-------|----------|-----------|
| Frontend | React (Vite + TS) in same repo as server | React (Vite + TS) — standalone `frontend/` |
| Backend | Node.js + Express + TypeScript (`server.ts`) | Python + Flask (`backend/app.py`) |
| Database | Flat JSON file (`db.json`) | MongoDB (via PyMongo) |
| Dev proxy | Vite middleware inside Express | Vite `server.proxy` → Flask |
| App logic | Identical — all routes, Praveen AI chat, partner data preserved |

The React components, UI, all Tailwind styling, the Razorpay modal, the seat‑selection widget, the PDF ticket, the star rating widget, and the Praveen AI chatbot logic are **100% unchanged**.
