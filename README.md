# UWE Event System - Flask Conversion Starter

This package converts your static project into a Flask application with a minimal database layer and without changing the structure too much.

## What is included
- `app.py` - Flask application with page routes and JSON API endpoints
- `db.py` - reusable `Database` class using SQLite
- `convert_to_flask.py` - copies your original HTML/CSS/JS/assets into Flask folders and rewrites links
- `templates/placeholder.html` - fallback page until your originals are copied
- `requirements.txt` - dependencies

## Database tables
- `users`
- `events`
- `contacts`
- `bookings`

## Improvements added
- password hashing with Werkzeug
- parameterized queries to avoid SQL injection
- booking transaction handling
- seed route for demo data
- event filtering API
- contact submission API
- login + registration API
- admin/user route protection via session checks
- indexes on commonly queried database fields

## How to use
1. Copy your original files into this same folder, next to `app.py`.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Run the converter:
   `python convert_to_flask.py`
4. Start the app:
   `python app.py`
5. Open:
   `http://127.0.0.1:5000/`
6. Seed sample data if needed:
   `http://127.0.0.1:5000/seed`

## Important note
Your original frontend JavaScript may still point to old static-only logic. The core Flask API endpoints provided are:
- `POST /login`
- `POST /api/register`
- `GET /api/events`
- `POST /api/events`
- `POST /api/contact`
- `POST /api/bookings`

You may only need small edits in your original JS files so they fetch these endpoints.

## Demo admin account after seeding
- Email: `admin@uweevents.local`
- Password: `admin123`

Change that immediately outside demo mode, because leaving it there would be a security goblin.
