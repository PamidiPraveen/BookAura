"""Gemini-powered BookAura assistant (function calling)."""
import os
import re
import time
from datetime import datetime, timedelta

import bleach
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

import services

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
# Tried in order when a model is retired (404) or overloaded (503). Google's own error message
# named gemini-3.8-flash as the current Flash model; the "-latest" names are moving aliases.
FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest",
                   "gemini-3-flash-preview"]
DEAD_MODELS: set = set()   # models that returned 404 this session - never tried again
ALLOWED_TAGS = ["strong", "b", "em", "i", "br", "ul", "ol", "li", "p"]

SYSTEM = """You are Praveen AI, the booking assistant of BookAura (India). You help users book
MOVIE tickets, HOTEL/HOSTEL stays and BUS tickets. Be warm, concise and practical.

TODAY: {today}.  USER: {name}.  USER LOCATION: {loc}.

RULES
- Never invent movies, theatres, hotels, buses or prices. Only use data returned by your tools.
- MOVIES: when the user wants movies/tickets/what's trending, call search_trending_movies.
  The UI shows cards with showtimes; keep your text to 1-2 short sentences. When the user picks a
  movie + theatre + showtime (the message usually contains all three and the price), call
  open_movie_seat_selection.
- HOTELS: call search_nearby_stays (use the user's current location unless they name another city).
  When they pick one, ask for check-in / check-out dates only if they have not given them
  (default: tonight, 1 night), then call open_hotel_room_selection.
- BUSES: you MUST know source city, destination city and travel date. Ask for whatever is missing,
  one short question at a time. Only real Indian cities are accepted; if a tool says a city is not
  recognised, ask the user to correct the spelling. Then call search_buses. When they pick a bus,
  call open_bus_seat_selection. If the user says "from here"/"my location", use their current city.
- If the location is unknown and you need it, ask the user to allow location access or tell you a city.
- After the user finishes seat/room selection (message mentions seats/room and total price), reply with
  a one-line summary and tell them the secure payment window is opening. After a payment-success
  message, congratulate them briefly and mention the ticket is in My Bookings and their email.
- Tell the user honestly that showtimes, hotel room prices and bus fares are simulated whenever a tool
  result says so (one short sentence, once per search).
- Format: plain text, you may use <strong>, <br/>, <ul><li>. No markdown tables, no code blocks.
- Stay on topic; politely decline unrelated requests."""


def _clean(html: str) -> str:
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"(?m)^\s*[\*\-]\s+(.+)$", r"• \1", html)
    html = html.replace("\n", "<br/>")
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes={}, strip=True)


def _strip(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def _history(messages: list[dict]) -> list[types.Content]:
    out: list[types.Content] = []
    for m in messages[-24:]:
        role = "user" if m.get("sender") == "user" else "model"
        text = _strip(m.get("text", ""))
        if not text:
            continue
        if out and out[-1].role == role:
            out[-1].parts[0].text += "\n" + text
        else:
            out.append(types.Content(role=role, parts=[types.Part(text=text)]))
    while out and out[0].role != "user":
        out.pop(0)
    return out


def run_chat(messages: list[dict], profile: dict | None, location: dict | None) -> dict:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return {"text": "⚠️ The AI service is not configured. Set <strong>GEMINI_API_KEY</strong> "
                        "in <strong>backend/.env</strong> and restart the server.", "action": None}

    profile, location = profile or {}, location or {}
    has_loc = location.get("lat") is not None and location.get("lng") is not None
    loc_txt = (f"{location.get('city') or 'unknown city'} ({location['lat']:.4f}, {location['lng']:.4f})"
               if has_loc else "NOT AVAILABLE (user has not shared location)")
    state: dict = {"action": None}

    def _origin(city: str):
        """Return (lat, lng, label) from a named city, else the user's GPS location."""
        if city and city.strip():
            c = services.find_city(city)
            if not c:
                return None, None, f"'{city}' is not a recognised Indian city."
            return c["lat"], c["lng"], c["name"]
        if has_loc:
            return location["lat"], location["lng"], location.get("city") or "your location"
        return None, None, "Location unavailable. Ask the user to allow location access or name a city."

    # ───────────── tools (docstrings are the model's instructions) ─────────────
    def search_trending_movies(city: str = "") -> dict:
        """Get currently trending/now-playing movies with showtimes at the nearest real theatres.
        Args:
            city: Optional city name. Leave empty to use the user's detected location.
        """
        lat, lng, label = _origin(city)
        if lat is None:
            return {"error": label}
        try:
            data = services.trending_with_shows(lat, lng)
        except Exception as e:
            print("MOVIE TOOL ERROR:", repr(e))
            return {"error": f"Movie service unavailable: {e}"}
        state["action"] = {"type": "show_results",
                           "data": {"kind": "movies", "area": label, "items": data["movies"]}}
        brief = [{"title": m["title"], "rating": m["rating"],
                  "theatres": [s["theatre"] for s in m["shows"]]} for m in data["movies"]]
        return {"area": label, "movies": brief, "theatresFound": data["theatresFound"],
                "note": data["note"], "uiShown": "Movie cards with booking buttons are displayed."}

    def open_movie_seat_selection(movie_name: str, theatre_name: str, showtime: str, price: int) -> dict:
        """Open the seat-selection grid once the user chose a movie, theatre and showtime.
        Args:
            movie_name: Exact movie title.
            theatre_name: Exact theatre name.
            showtime: Showtime such as '06:30 PM'.
            price: Price per seat in rupees.
        """
        state["action"] = {"type": "select_movie_seats", "data": {
            "movieName": movie_name, "theatreName": theatre_name, "showtime": showtime,
            "price": int(price)}}
        return {"ok": True}

    def search_nearby_stays(city: str = "") -> dict:
        """Find real hotels/hostels/guest houses near the user's location (or a named city).
        Args:
            city: Optional city name. Leave empty to use the user's detected location.
        """
        lat, lng, label = _origin(city)
        if lat is None:
            return {"error": label}
        try:
            data = services.stays_near(lat, lng)
        except Exception as e:
            print("STAY TOOL ERROR:", repr(e))
            return {"error": f"Stay search unavailable: {e}"}
        if not data["stays"]:
            return {"area": label, "stays": [], "note": "No listed properties found nearby."}
        state["action"] = {"type": "show_results",
                           "data": {"kind": "hotels", "area": label, "items": data["stays"]}}
        brief = [{"name": s["name"], "type": s["type"], "distanceKm": s["distanceKm"],
                  "pricePerNight": s["pricePerNight"]} for s in data["stays"]]
        return {"area": label, "stays": brief, "note": data["note"],
                "uiShown": "Stay cards with a Book button are displayed."}

    def open_hotel_room_selection(hotel_name: str, price_per_night: int, available_rooms: str = "",
                                  check_in: str = "", check_out: str = "") -> dict:
        """Open the room picker for a chosen stay.
        Args:
            hotel_name: Exact property name.
            price_per_night: Rupees per night.
            available_rooms: Comma separated room numbers from the search result (optional).
            check_in: YYYY-MM-DD (default today).
            check_out: YYYY-MM-DD (default tomorrow).
        """
        today = datetime.utcnow().date()
        state["action"] = {"type": "select_hotel_options", "data": {
            "hotelName": hotel_name, "price": int(price_per_night),
            "availableRooms": [r.strip() for r in available_rooms.split(",") if r.strip()] or None,
            "checkInDate": check_in or today.isoformat(),
            "checkOutDate": check_out or (today + timedelta(days=1)).isoformat()}}
        return {"ok": True}

    def check_city(name: str) -> dict:
        """Verify that a city/town name is real (India). Use before searching buses if unsure.
        Args:
            name: City name typed by the user.
        """
        c = services.find_city(name)
        return {"valid": bool(c), "city": c["name"] if c else None, "state": c["state"] if c else None}

    def search_buses(source: str, destination: str, date: str) -> dict:
        """Search intercity buses between two real Indian cities on a date.
        Args:
            source: Departure city.
            destination: Arrival city.
            date: Travel date as YYYY-MM-DD.
        """
        try:
            data = services.search_buses(source, destination, date)
        except Exception as e:
            print("BUS TOOL ERROR:", repr(e))
            return {"error": f"Bus search unavailable: {e}"}
        if "error" in data:
            return data
        state["action"] = {"type": "show_results", "data": {"kind": "buses", **data}}
        return {"route": f"{data['source']} to {data['destination']}", "date": data["date"],
                "count": len(data["buses"]), "note": data["note"],
                "uiShown": "Bus cards with a Select seats button are displayed."}

    def open_bus_seat_selection(operator: str, source: str, destination: str, price: int,
                                departure_date: str, departure_time: str = "") -> dict:
        """Open the bus seat layout once the user picked a bus.
        Args:
            operator: Bus operator name.
            source: Departure city.
            destination: Arrival city.
            price: Fare per seat in rupees.
            departure_date: YYYY-MM-DD.
            departure_time: e.g. '09:30 PM'.
        """
        state["action"] = {"type": "select_bus_seats", "data": {
            "busOperator": operator, "source": source, "destination": destination,
            "price": int(price), "departureDate": departure_date, "departureTime": departure_time}}
        return {"ok": True}

    tools = [search_trending_movies, open_movie_seat_selection, search_nearby_stays,
             open_hotel_room_selection, check_city, search_buses, open_bus_seat_selection]

    contents = _history(messages)
    if not contents:
        return {"text": "Hi! Tell me what you'd like to book — movies, hotels or buses.", "action": None}

    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM.format(today=datetime.utcnow().strftime("%A, %d %B %Y"),
                                        name=profile.get("name", "Customer"), loc=loc_txt),
        tools=tools, temperature=0.4, max_output_tokens=600,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=6),
    )
    client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=20000))  # 20s per call
    TRANSIENT = (404, 429, 500, 502, 503, 504)  # model gone / overloaded -> try next model, then retry once
    text, last_err = None, None
    for attempt in range(3):
        candidates = [m for m in dict.fromkeys([MODEL] + FALLBACK_MODELS) if m not in DEAD_MODELS]
        for model in candidates:
            try:
                resp = client.models.generate_content(model=model, contents=contents, config=cfg)
                text = resp.text or "Done! Let me know what else you need."
                break
            except genai_errors.APIError as e:
                last_err = e
                code = getattr(e, "code", 0)
                print(f"Gemini API error (model={model}, attempt={attempt + 1}): {code} {e}")
                if code == 404:
                    DEAD_MODELS.add(model)   # retired / unavailable: skip it from now on
                if code in TRANSIENT:
                    continue
                break
            except Exception as e:     # timeout / network -> try the next model
                print(f"Chat error (model={model}):", repr(e))
                last_err = None
                continue
        if text is not None or (last_err is not None and getattr(last_err, "code", 0) not in (429, 500, 502, 503, 504)):
            break
        time.sleep(2.0 * (attempt + 1))  # overloaded: pause (2s, then 4s), then another pass over the models

    if text is None:
        code = getattr(last_err, "code", 0)
        if code in (400, 401, 403):
            msg = "The AI key was rejected. Please check <strong>GEMINI_API_KEY</strong> in backend/.env."
        elif code in (429, 500, 502, 503, 504):
            msg = "Google's AI servers are busy right now. Please send your message again in a few seconds."
        elif code == 404:
            msg = ("None of the configured Gemini models exist any more. Set <strong>GEMINI_MODEL</strong> "
                   "in backend/.env to a current model name from Google AI Studio.")
        else:
            msg = "The AI service had a hiccup. Please try again (details are in the Flask terminal)."
        return {"text": msg, "action": None}

    return {"text": _clean(text), "action": state["action"]}