"""
BookAura data services.

REAL data (free, no partner agreement needed):
  - Reverse geocoding / city lookup ........ OpenStreetMap Nominatim
  - Nearby cinemas and hotels/hostels ...... OpenStreetMap Overpass API
  - Movie details ........................ OMDb (OMDB_API_KEY + now_showing.txt) or TMDB (TMDB_API_KEY)

SIMULATED data (no free public API exists):
  - Movie showtimes, seat prices, hotel room prices/availability,
    bus operators/timings/fares. These are generated deterministically so the
    same search returns the same results. Replace the `_simulated_*`
    functions with a partner API (AbhiBus / RedBus / BookMyShow / Booking.com)
    when you have credentials.
"""
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
import os
import random
import time
from datetime import datetime, timedelta

import requests

# OpenStreetMap blocks generic/placeholder User-Agents (HTTP 403). Set CONTACT_EMAIL in .env to your real email.
UA = {"User-Agent": f"BookAura/1.0 (student project; contact: {os.getenv('CONTACT_EMAIL', 'unknown')})"}
TMDB_KEY = os.getenv("TMDB_API_KEY", "")
OMDB_KEY = os.getenv("OMDB_API_KEY", "")
NOW_SHOWING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "now_showing.txt")
TMDB_IMG = "https://image.tmdb.org/t/p/w342"

_cache: dict = {}


def _cached(key, ttl, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


def _seed(*parts) -> random.Random:
    h = hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(h[:12], 16))


def haversine(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ───────────────────────── Geocoding (Nominatim) ─────────────────────────────
def _reverse_nominatim(lat, lng) -> dict:
    r = requests.get(
        "https://nominatim.openstreetmap.org/reverse",
        params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 12, "addressdetails": 1},
        headers=UA, timeout=10,
    )
    r.raise_for_status()
    j = r.json()
    a = j.get("address", {})
    city = (a.get("city") or a.get("town") or a.get("village") or a.get("suburb")
            or a.get("county") or a.get("state_district") or "")
    return {"lat": lat, "lng": lng, "city": city, "state": a.get("state", ""),
            "country": a.get("country", ""), "display": j.get("display_name", "")}


def _reverse_bigdatacloud(lat, lng) -> dict:
    """Free, key-less fallback used when Nominatim refuses or is down."""
    r = requests.get(
        "https://api.bigdatacloud.net/data/reverse-geocode-client",
        params={"latitude": lat, "longitude": lng, "localityLanguage": "en"}, timeout=10,
    )
    r.raise_for_status()
    j = r.json()
    city = j.get("city") or j.get("locality") or ""
    return {"lat": lat, "lng": lng, "city": city, "state": j.get("principalSubdivision", ""),
            "country": j.get("countryName", ""),
            "display": ", ".join(x for x in [j.get("locality"), j.get("city"),
                                              j.get("principalSubdivision"), j.get("countryName")] if x)}


def reverse_geocode(lat: float, lng: float) -> dict:
    def go():
        try:
            return _reverse_nominatim(lat, lng)
        except Exception as e:
            print("Nominatim reverse failed, using fallback:", e)
            return _reverse_bigdatacloud(lat, lng)
    return _cached(("rev", round(lat, 2), round(lng, 2)), 3600, go)


def find_city(name: str, country_code: str = "in") -> dict | None:
    """Resolve a real, named place to coordinates. Returns None if not found."""
    name = (name or "").strip()
    if not name:
        return None

    def go():
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": name, "format": "jsonv2", "limit": 5, "addressdetails": 1,
                    "countrycodes": country_code},
            headers=UA, timeout=10,
        )
        r.raise_for_status()
        for it in r.json():
            if it.get("category") in ("place", "boundary") or it.get("type") in (
                    "city", "town", "village", "administrative", "suburb"):
                a = it.get("address", {})
                nm = (a.get("city") or a.get("town") or a.get("village") or it.get("name") or name)
                return {"name": nm, "state": a.get("state", ""), "lat": float(it["lat"]),
                        "lng": float(it["lon"])}
        return None
    return _cached(("city", name.lower(), country_code), 86400, go)


def suggest_cities(query: str, limit: int = 6) -> list[dict]:
    query = (query or "").strip()
    if len(query) < 2:
        return []

    def go():
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "jsonv2", "limit": 10, "addressdetails": 1,
                    "countrycodes": "in"},
            headers=UA, timeout=10,
        )
        r.raise_for_status()
        out, seen = [], set()
        for it in r.json():
            if it.get("category") not in ("place", "boundary"):
                continue
            a = it.get("address", {})
            nm = a.get("city") or a.get("town") or a.get("village") or it.get("name")
            key = (nm, a.get("state"))
            if not nm or key in seen:
                continue
            seen.add(key)
            out.append({"name": nm, "state": a.get("state", ""),
                        "lat": float(it["lat"]), "lng": float(it["lon"])})
        return out[:limit]
    return _cached(("sug", query.lower()), 3600, go)


# ───────────────────────── Overpass (cinemas / hotels) ───────────────────────
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def _overpass(query: str) -> list[dict]:
    """Ask every mirror at once and return the first successful answer (free servers are often overloaded)."""
    def one(url):
        r = requests.post(url, data={"data": query}, headers=UA, timeout=14)
        r.raise_for_status()
        return r.json().get("elements", [])

    pool = ThreadPoolExecutor(max_workers=len(OVERPASS_MIRRORS))
    futures = {pool.submit(one, u): u for u in OVERPASS_MIRRORS}
    last = None
    try:
        for f in as_completed(futures, timeout=16):
            try:
                return f.result()
            except Exception as e:
                last = e
                print("Overpass mirror failed:", futures[f], repr(e))
    except Exception as e:  # overall timeout
        last = e
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise RuntimeError(f"All Overpass servers failed: {last!r}")


def _nominatim_places(terms: list[str], lat: float, lng: float, radius_m: int) -> list[dict]:
    """Fallback when Overpass is down: search Nominatim inside a box around the user."""
    dlat = radius_m / 111000.0
    dlng = radius_m / (111000.0 * max(0.2, math.cos(math.radians(lat))))
    box = f"{lng - dlng},{lat + dlat},{lng + dlng},{lat - dlat}"

    def one(term):
        r = requests.get("https://nominatim.openstreetmap.org/search",
                         params={"q": term, "format": "jsonv2", "limit": 20, "bounded": 1,
                                 "viewbox": box, "addressdetails": 1},
                         headers=UA, timeout=10)
        r.raise_for_status()
        return r.json()

    items, seen = [], set()
    with ThreadPoolExecutor(max_workers=len(terms)) as pool:
        for res in pool.map(one, terms):
            for it in res:
                name = it.get("name") or it.get("display_name", "").split(",")[0]
                la, lo = float(it["lat"]), float(it["lon"])
                key = (name, round(la, 4), round(lo, 4))
                if not name or key in seen:
                    continue
                seen.add(key)
                items.append({"name": name, "lat": la, "lng": lo, "tags": {"tourism": it.get("type", "hotel")},
                              "distanceKm": round(haversine(lat, lng, la, lo), 1)})
    return items


def _nearby(selector: str, lat: float, lng: float, radius_m: int, limit: int, terms: list[str]) -> list[dict]:
    def go():
        q = (f'[out:json][timeout:10];nwr{selector}(around:{radius_m},{lat},{lng});out center 40;')
        try:
            items = []
            for el in _overpass(q):
                tags = el.get("tags", {})
                name = tags.get("name")
                la = el.get("lat") or el.get("center", {}).get("lat")
                lo = el.get("lon") or el.get("center", {}).get("lon")
                if not name or la is None or lo is None:
                    continue
                items.append({"name": name, "lat": la, "lng": lo, "tags": tags,
                              "distanceKm": round(haversine(lat, lng, la, lo), 1)})
        except Exception as e:
            print("Overpass unavailable, falling back to Nominatim:", e)
            items = _nominatim_places(terms, lat, lng, radius_m)
        items.sort(key=lambda x: x["distanceKm"])
        return items
    items = _cached(("op", selector, round(lat, 2), round(lng, 2), radius_m), 1800, go)
    return items[:limit]


def nearby_cinemas(lat, lng, limit=6):
    for radius in (8000, 20000, 40000):  # widen search if nothing nearby
        res = _nearby('["amenity"="cinema"]', lat, lng, radius, limit, ["cinema"])
        if res:
            return res
    return []


def nearby_stays(lat, lng, limit=8):
    for radius in (6000, 15000, 30000):
        res = _nearby('["tourism"~"^(hotel|hostel|guest_house|motel)$"]', lat, lng, radius, limit,
                      ["hotel", "hostel", "guest house"])
        if res:
            return res
    return []


# ───────────────────────── Movies (TMDB + simulated shows) ───────────────────
def tmdb_movies(limit=8) -> list[dict]:
    if not TMDB_KEY:
        raise RuntimeError("TMDB_API_KEY is not configured on the server.")

    def go():
        r = requests.get("https://api.themoviedb.org/3/movie/now_playing",
                         params={"api_key": TMDB_KEY, "region": "IN", "language": "en-US", "page": 1},
                         timeout=10)
        r.raise_for_status()
        res = r.json().get("results", [])
        res.sort(key=lambda m: m.get("popularity", 0), reverse=True)
        return [{
            "id": m["id"], "title": m["title"],
            "rating": round(m.get("vote_average", 0), 1),
            "poster": (TMDB_IMG + m["poster_path"]) if m.get("poster_path") else "",
            "overview": (m.get("overview") or "")[:140],
            "release": m.get("release_date", ""),
        } for m in res]
    return _cached(("tmdb",), 1800, go)[:limit]


def _now_showing_titles() -> list[str]:
    """Titles currently in cinemas. OMDb has no 'now playing' endpoint, so YOU maintain this list."""
    try:
        with open(NOW_SHOWING_FILE, encoding="utf-8") as f:
            return [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    except FileNotFoundError:
        print("now_showing.txt not found - using built-in example titles. Create the file to customise.")
        return ["Inception", "Interstellar", "Dune: Part Two", "Oppenheimer", "The Dark Knight"]


def omdb_movies(limit=8) -> list[dict]:
    if not OMDB_KEY:
        raise RuntimeError("OMDB_API_KEY is not configured on the server.")
    titles = _now_showing_titles()
    if not titles:
        raise RuntimeError("now_showing.txt has no titles - add one movie title per line.")

    def one(title):
        def go():
            r = requests.get("https://www.omdbapi.com/",
                             params={"apikey": OMDB_KEY, "t": title, "type": "movie", "plot": "short"},
                             timeout=10)
            r.raise_for_status()
            j = r.json()
            if j.get("Response") != "True":
                return None
            try:
                rating = round(float(j.get("imdbRating", "0")), 1)
            except ValueError:
                rating = 0.0
            poster = j.get("Poster", "")
            return {"id": j.get("imdbID", title), "title": j.get("Title", title), "rating": rating,
                    "poster": poster if poster.startswith("http") else "",
                    "overview": (j.get("Plot") or "")[:140], "release": j.get("Released", "")}
        return _cached(("omdb", title.lower()), 86400, go)  # 24h cache -> few of the 1,000 free daily calls

    def safe(t):
        try:
            return one(t)
        except Exception as e:
            print("OMDb error for", t, e)
            return None

    with ThreadPoolExecutor(max_workers=5) as pool:   # look titles up in parallel
        out = [m for m in pool.map(safe, titles[:limit]) if m]
    if not out:
        raise RuntimeError("OMDb returned no movies. Check that OMDB_API_KEY is activated (open "
                           "https://www.omdbapi.com/?t=Inception&apikey=YOURKEY in a browser) "
                           "and that the titles in now_showing.txt are spelled correctly.")
    return out


def get_movies(limit=8) -> list[dict]:
    provider = os.getenv("MOVIE_PROVIDER", "").lower() or ("omdb" if OMDB_KEY else "tmdb")
    return omdb_movies(limit) if provider == "omdb" else tmdb_movies(limit)


def trending_with_shows(lat, lng, max_movies=6, theatres_per_movie=3) -> dict:
    with ThreadPoolExecutor(max_workers=2) as pool:   # movies + cinemas at the same time
        f_movies = pool.submit(get_movies, max_movies)
        f_theatres = pool.submit(nearby_cinemas, lat, lng, 6)
        movies = f_movies.result()
        try:
            theatres = f_theatres.result()
        except Exception as e:   # OpenStreetMap busy: still show movies instead of failing completely
            print("Cinema lookup failed:", repr(e))
            theatres = []
    out = []
    for m in movies:
        shows = []
        for th in theatres[:theatres_per_movie] if theatres else []:
            rng = _seed(m["id"], th["name"], datetime.utcnow().strftime("%Y-%m-%d"))
            times = sorted(rng.sample(["10:00 AM", "12:30 PM", "03:15 PM", "06:30 PM", "09:45 PM"], 3),
                           key=lambda t: datetime.strptime(t, "%I:%M %p"))
            shows.append({"theatre": th["name"], "distanceKm": th["distanceKm"],
                          "showtimes": times, "price": rng.choice([150, 180, 220, 250, 300])})
        out.append({**m, "shows": shows})
    note = ("Movies and theatres are real (OMDb or TMDB / OpenStreetMap). Showtimes and prices are simulated."
            if theatres else
            "Movies are real, but no theatres could be loaded right now (map service busy or none mapped nearby). "
            "Tell the user to try again in a minute or pick a bigger nearby city.")
    return {"movies": out, "theatresFound": len(theatres), "note": note}


# ───────────────────────── Hotels / hostels ──────────────────────────────────
def stays_near(lat, lng, limit=6) -> dict:
    kind_label = {"hotel": "Hotel", "hostel": "Hostel", "guest_house": "Guest House", "motel": "Motel"}
    base = {"hotel": 2800, "hostel": 700, "guest_house": 1500, "motel": 1900}
    out = []
    for h in nearby_stays(lat, lng, limit):
        kind = h["tags"].get("tourism", "hotel")
        rng = _seed(h["name"], h["lat"], h["lng"])
        floors = [1, 2, 3]
        rooms = sorted({f"{rng.choice(floors)}{rng.randint(1, 20):02d}" for _ in range(8)})
        out.append({
            "name": h["name"], "type": kind_label.get(kind, "Hotel"),
            "distanceKm": h["distanceKm"], "lat": h["lat"], "lng": h["lng"],
            "address": ", ".join(filter(None, [h["tags"].get("addr:street"), h["tags"].get("addr:city")])),
            "phone": h["tags"].get("phone", ""),
            "pricePerNight": int(round(base.get(kind, 2000) * rng.uniform(0.7, 1.5), -1)),
            "availableRooms": rooms,
        })
    return {"stays": out,
            "note": "Properties are real (OpenStreetMap). Room prices and availability are simulated."}


# ───────────────────────── Buses (simulated, AbhiBus-style) ──────────────────
OPERATORS = [
    ("VRL Travels", "Volvo Multi-Axle AC Sleeper", 2.0),
    ("SRS Travels", "Mercedes AC Sleeper (2+1)", 2.2),
    ("Orange Travels", "Volvo AC Semi-Sleeper", 1.8),
    ("KSRTC / APSRTC Super Luxury", "Non-AC Seater (2+2)", 1.1),
    ("Kaveri Travels", "AC Seater/Sleeper", 1.6),
    ("Morning Star Travels", "Scania AC Sleeper", 2.1),
]


def search_buses(source: str, destination: str, date: str) -> dict:
    src, dst = find_city(source), find_city(destination)
    if not src:
        return {"error": f"'{source}' is not a recognised Indian city or town."}
    if not dst:
        return {"error": f"'{destination}' is not a recognised Indian city or town."}
    if src["name"].lower() == dst["name"].lower():
        return {"error": "Source and destination are the same city."}
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except Exception:
        d = (datetime.utcnow() + timedelta(days=1)).date()
    if d < datetime.utcnow().date():
        d = datetime.utcnow().date()

    road_km = max(30.0, haversine(src["lat"], src["lng"], dst["lat"], dst["lng"]) * 1.3)
    rng = _seed(src["name"], dst["name"], d.isoformat())
    ops = rng.sample(OPERATORS, 5)
    buses = []
    for name, btype, rate in ops:
        dep_h = rng.choice([6, 8, 13, 17, 19, 21, 22, 23])
        dep_m = rng.choice([0, 15, 30, 45])
        dep = datetime(d.year, d.month, d.day, dep_h, dep_m)
        hours = road_km / rng.uniform(48, 60)
        arr = dep + timedelta(hours=hours)
        price = int(round(max(150, road_km * rate * rng.uniform(0.9, 1.15)), -1))
        buses.append({
            "operator": name, "busType": btype,
            "departure": dep.strftime("%I:%M %p"), "arrival": arr.strftime("%I:%M %p"),
            "arrivesNextDay": arr.date() > dep.date(),
            "duration": f"{int(hours)}h {int((hours % 1) * 60):02d}m",
            "price": price, "seatsLeft": rng.randint(4, 28),
            "rating": round(rng.uniform(3.8, 4.7), 1),
        })
    buses.sort(key=lambda b: datetime.strptime(b["departure"], "%I:%M %p"))
    return {"source": src["name"], "destination": dst["name"], "date": d.isoformat(),
            "distanceKm": int(road_km), "buses": buses,
            "note": "Cities are real (OpenStreetMap). Operators, fares and seats are simulated "
                    "until a partner bus API is connected."}