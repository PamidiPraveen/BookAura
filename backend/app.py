from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import random
import string
import os
from dotenv import load_dotenv

load_dotenv()  # must run before importing ai/services (they read env vars)

import ai
import services

app = Flask(__name__)
CORS(app)

# ── MongoDB Connection ───────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["bookaura"]

users_col       = db["users"]
bookings_col    = db["bookings"]
transactions_col = db["transactions"]
emails_col      = db["emails"]
otps_col        = db["otps"]

# ── Seed default user if empty ────────────────────────────────────────────────
def seed_db():
    if users_col.count_documents({}) == 0:
        default_user = {
            "_id": "mock_user_1",
            "email": "joyboyluffy7203111@gmail.com",
            "password": "password123",
            "profile": {
                "name": "Luffy Joyboy",
                "email": "joyboyluffy7203111@gmail.com",
                "number": "+91 9876543210",
                "age": 19,
                "dob": "2007-05-05",
                "photoUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
            }
        }
        users_col.insert_one(default_user)

    if bookings_col.count_documents({}) == 0:
        bookings_col.insert_one({
            "_id": "b_init_1",
            "userId": "mock_user_1",
            "type": "movie",
            "title": "Interstellar at PVR IMAX",
            "date": "2026-06-26",
            "price": 600,
            "status": "Success",
            "details": {
                "movieName": "Interstellar",
                "theatreName": "PVR IMAX",
                "showtime": "4:30 PM",
                "seats": ["E10", "E11"]
            },
            "createdAt": datetime.utcnow().isoformat()
        })

    if transactions_col.count_documents({}) == 0:
        transactions_col.insert_one({
            "_id": "t_init_1",
            "userId": "mock_user_1",
            "bookingId": "b_init_1",
            "type": "movie",
            "title": "Interstellar at PVR IMAX",
            "amount": 600,
            "paymentMethod": "UPI (Razorpay)",
            "status": "Success",
            "createdAt": datetime.utcnow().isoformat()
        })

seed_db()

# ── Helper ────────────────────────────────────────────────────────────────────
def rand_id(prefix=""):
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=9))

def serialize(doc):
    """Convert MongoDB _id to id for JSON output."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

# ── Partner Data ──────────────────────────────────────────────────────────────
PARTNERS = {
    "movies": [
        {"id": "m1", "title": "Inception: Re-release", "theatres": ["PVR Directors Cut", "INOX Forum Mall", "Cinepolis Onyx"],
         "showtimes": ["12:30 PM", "3:45 PM", "7:00 PM", "10:15 PM"], "price": 250},
        {"id": "m2", "title": "Interstellar", "theatres": ["PVR IMAX", "INOX Galleria", "Cinepolis Premium"],
         "showtimes": ["1:15 PM", "4:30 PM", "8:00 PM", "11:15 PM"], "price": 300},
        {"id": "m3", "title": "Dune: Part Two", "theatres": ["PVR Directors Cut", "INOX Forum Mall"],
         "showtimes": ["11:00 AM", "2:30 PM", "6:00 PM", "9:30 PM"], "price": 280}
    ],
    "hotels": [
        {"id": "h1", "name": "Taj Residency Luxury Stay", "pricePerNight": 4500,
         "availableRooms": ["101", "104", "202", "205", "301", "302"]},
        {"id": "h2", "name": "Marriott Comfort Suites", "pricePerNight": 3500,
         "availableRooms": ["110", "112", "214", "215", "401", "402"]},
        {"id": "h3", "name": "Ginger Budget Stays", "pricePerNight": 1800,
         "availableRooms": ["105", "106", "107", "208", "209", "310"]}
    ],
    "buses": [
        {"id": "b1", "operator": "VRL Travels (Sleeper AC)",
         "routes": [{"source": "Mumbai", "destination": "Goa", "price": 1200, "departureTimes": ["08:00 PM", "10:00 PM"]},
                    {"source": "Bangalore", "destination": "Goa", "price": 1000, "departureTimes": ["09:00 PM", "11:00 PM"]}]},
        {"id": "b2", "operator": "National Travels (Seater Semi-Sleeper)",
         "routes": [{"source": "Mumbai", "destination": "Pune", "price": 400, "departureTimes": ["07:00 AM", "12:00 PM", "05:00 PM"]},
                    {"source": "Delhi", "destination": "Agra", "price": 500, "departureTimes": ["06:00 AM", "01:00 PM", "06:00 PM"]}]},
        {"id": "b3", "operator": "KSRTC Swift (Premium AC Multi-Axle)",
         "routes": [{"source": "Bangalore", "destination": "Chennai", "price": 850, "departureTimes": ["07:30 AM", "02:30 PM", "10:30 PM"]},
                    {"source": "Bangalore", "destination": "Hyderabad", "price": 950, "departureTimes": ["08:30 PM", "10:30 PM"]}]}
    ]
}

# ═══════════════════════════════ AUTH ROUTES ══════════════════════════════════

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.json
    email    = data.get("email", "").lower().strip()
    password = data.get("password", "")
    name     = data.get("name", "")
    if not email or not password or not name:
        return jsonify({"error": "Missing required signup fields"}), 400
    if users_col.find_one({"email": email}):
        return jsonify({"error": "User already exists with this email"}), 400

    photo_seed = "1472099645785-5658abf4ff4e" if random.random() > 0.5 else "1494790108377-be9c29b29330"
    uid = rand_id("u_")
    new_user = {
        "_id": uid,
        "email": email,
        "password": password,
        "profile": {
            "name": name,
            "email": email,
            "number": data.get("number", ""),
            "age": int(data.get("age", 25) or 25),
            "dob": data.get("dob", "1999-01-01"),
            "photoUrl": f"https://images.unsplash.com/photo-{photo_seed}?auto=format&fit=crop&w=150&h=150&q=80"
        }
    }
    users_col.insert_one(new_user)
    return jsonify({"success": True, "userId": uid, "profile": new_user["profile"]})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.json
    email    = data.get("email", "").lower().strip()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    user = users_col.find_one({"email": email, "password": password})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify({"success": True, "userId": str(user["_id"]), "profile": user["profile"]})


@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    data  = request.json
    email = data.get("email", "").lower().strip()
    name  = data.get("name", "")
    if not email or not name:
        return jsonify({"error": "Email and Name are required"}), 400
    user = users_col.find_one({"email": email})
    if not user:
        uid = rand_id("u_google_")
        user = {
            "_id": uid,
            "email": email,
            "password": "google-oauth-password",
            "profile": {
                "name": name,
                "email": email,
                "number": "+91 9999999999",
                "age": 23,
                "dob": "2003-01-01",
                "photoUrl": data.get("photoUrl", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80")
            }
        }
        users_col.insert_one(user)
    return jsonify({"success": True, "userId": str(user["_id"]), "profile": user["profile"]})


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    email = request.json.get("email", "").lower().strip()
    if not email:
        return jsonify({"error": "Email is required"}), 400
    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"error": "No user found with this email"}), 404

    otp = "".join(random.choices(string.digits, k=6))
    expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

    otps_col.delete_many({"email": email})
    otps_col.insert_one({"email": email, "otp": otp, "expiresAt": expires_at})

    email_doc = {
        "_id": rand_id("em_"),
        "to": email,
        "subject": "Reset your Ticket Booking Password - OTP Verification",
        "body": (
            f"Hello {user['profile']['name']},\n\n"
            f"We received a request to reset your password. Use the following 6-digit One Time Password (OTP) to proceed:\n\n"
            f"🔑 OTP Code: {otp}\n\n"
            f"This OTP is valid for 5 minutes. If you did not request a password reset, please ignore this email.\n\n"
            f"Best regards,\nBookAura Ticket Booking Team"
        ),
        "type": "otp",
        "createdAt": datetime.utcnow().isoformat()
    }
    emails_col.insert_one(email_doc)
    return jsonify({"success": True, "message": "OTP sent successfully. Check your in-app Email Inbox!"})


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data         = request.json
    email        = data.get("email", "").lower().strip()
    otp          = data.get("otp", "")
    new_password = data.get("newPassword", "")
    if not email or not otp or not new_password:
        return jsonify({"error": "Missing verification parameters"}), 400

    record = otps_col.find_one({"email": email, "otp": otp})
    if not record:
        return jsonify({"error": "Invalid OTP code"}), 400
    if datetime.utcnow() > datetime.fromisoformat(record["expiresAt"]):
        return jsonify({"error": "OTP code has expired"}), 400

    users_col.update_one({"email": email}, {"$set": {"password": new_password}})
    otps_col.delete_many({"email": email})
    return jsonify({"success": True, "message": "Password updated successfully!"})


# ═══════════════════════════════ PROFILE ROUTES ═══════════════════════════════

@app.route("/api/profile/<user_id>", methods=["GET"])
def get_profile(user_id):
    user = users_col.find_one({"_id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"profile": user["profile"]})


@app.route("/api/profile/<user_id>", methods=["POST"])
def update_profile(user_id):
    user = users_col.find_one({"_id": user_id})
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json
    updated = {
        **user["profile"],
        "name":     data.get("name", user["profile"]["name"]),
        "number":   data.get("number", user["profile"]["number"]),
        "age":      int(data.get("age", user["profile"]["age"]) or user["profile"]["age"]),
        "dob":      data.get("dob", user["profile"]["dob"]),
        "photoUrl": data.get("photoUrl", user["profile"]["photoUrl"]) or user["profile"]["photoUrl"]
    }
    users_col.update_one({"_id": user_id}, {"$set": {"profile": updated}})
    return jsonify({"success": True, "profile": updated})


# ═══════════════════════════ BOOKINGS & TRANSACTIONS ══════════════════════════

@app.route("/api/bookings/<user_id>", methods=["GET"])
def get_bookings(user_id):
    docs = list(bookings_col.find({"userId": user_id}))
    return jsonify({"bookings": [serialize(d) for d in docs]})


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data   = request.json
    uid    = data.get("userId")
    btype  = data.get("type")
    title  = data.get("title")
    price  = data.get("price")
    details = data.get("details")
    if not all([uid, btype, title, price, details]):
        return jsonify({"error": "Missing booking details"}), 400

    user = users_col.find_one({"_id": uid})
    if not user:
        return jsonify({"error": "User not found"}), 404

    bid = rand_id("b_")
    tid = rand_id("t_")
    now = datetime.utcnow().isoformat()
    payment_method = data.get("paymentMethod", "Razorpay Payment Gateway")

    booking = {
        "_id": bid,
        "userId": uid,
        "type": btype,
        "title": title,
        "date": data.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "price": float(price),
        "status": "Success",
        "details": details,
        "createdAt": now
    }
    transaction = {
        "_id": tid,
        "userId": uid,
        "bookingId": bid,
        "type": btype,
        "title": title,
        "amount": float(price),
        "paymentMethod": payment_method,
        "status": "Success",
        "createdAt": now
    }
    bookings_col.insert_one(booking)
    transactions_col.insert_one(transaction)

    # Build ticket email body
    if btype == "movie":
        ticket_body = (
            f"🍿 Movie Name: {details.get('movieName')}\n"
            f"🏢 Theatre: {details.get('theatreName')}\n"
            f"🕒 Showtime: {details.get('showtime')}\n"
            f"💺 Selected Seats: {', '.join(details.get('seats', []))}"
        )
    elif btype == "bus":
        ticket_body = (
            f"🚌 Bus Operator: {details.get('busOperator')}\n"
            f"📍 Journey: {details.get('source')} ➔ {details.get('destination')}\n"
            f"🕒 Date: {details.get('departureDate')}\n"
            f"💺 Selected Seats: {', '.join(details.get('seats', []))}"
        )
    else:
        ticket_body = (
            f"🏨 Hotel: {details.get('hotelName')}\n"
            f"🛏️ Room Type: {details.get('roomType')}\n"
            f"🚪 Room Preferred: {details.get('roomNumber')}\n"
            f"📅 Stay: {details.get('checkInDate')} to {details.get('checkOutDate')}"
        )

    emails_col.insert_one({
        "_id": rand_id("em_"),
        "to": user["profile"]["email"],
        "subject": f"Booking Confirmed: {title} - Ticket ID #{bid}",
        "body": (
            f"Dear {user['profile']['name']},\n\nYour booking was successfully processed!\n\n"
            f"=========================================\n🎟️ TICKET CONFIRMATION\n=========================================\n"
            f"{ticket_body}\n\n💵 Total Paid: ₹{price}\n💳 Method: {payment_method}\n"
            f"=========================================\n\nThank you for choosing BookAura!\n\nBest regards,\nBookAura Automated Notification System"
        ),
        "type": "ticket",
        "ticketId": bid,
        "createdAt": now
    })

    return jsonify({"success": True, "booking": serialize(booking), "transaction": serialize(transaction)})


@app.route("/api/transactions/<user_id>", methods=["GET"])
def get_transactions(user_id):
    docs = list(transactions_col.find({"userId": user_id}))
    return jsonify({"transactions": [serialize(d) for d in docs]})


# ═══════════════════════════════ EMAILS ROUTE ═════════════════════════════════

@app.route("/api/emails/<email_addr>", methods=["GET"])
def get_emails(email_addr):
    docs = list(emails_col.find({"to": email_addr.lower()}))
    docs.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return jsonify({"emails": [serialize(d) for d in docs]})


# ═══════════════════════════════ PARTNERS ROUTE ═══════════════════════════════

@app.route("/api/partners", methods=["GET"])
def get_partners():
    return jsonify(PARTNERS)


# ═══════════════════════════════ GEO ROUTES ═══════════════════════════════════

@app.route("/api/geo/reverse", methods=["GET"])
def geo_reverse():
    try:
        lat, lng = float(request.args["lat"]), float(request.args["lng"])
    except (KeyError, ValueError):
        return jsonify({"error": "lat and lng are required"}), 400
    try:
        return jsonify(services.reverse_geocode(lat, lng))
    except Exception as e:
        print("Reverse geocode error:", e)
        # Still return coordinates so the map marker works even if the lookup fails
        return jsonify({"lat": lat, "lng": lng, "city": "", "state": "", "country": "", "display": ""})


@app.route("/api/geo/cities", methods=["GET"])
def geo_cities():
    try:
        return jsonify({"cities": services.suggest_cities(request.args.get("q", ""))})
    except Exception as e:
        print("City search error:", e)
        return jsonify({"cities": []})


# ═══════════════════════════════ CHAT ROUTE (Gemini) ══════════════════════════

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    messages = data.get("messages", [])
    if not isinstance(messages, list):
        return jsonify({"error": "Messages list is required"}), 400
    result = ai.run_chat(messages, data.get("userProfile"), data.get("location"))
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
