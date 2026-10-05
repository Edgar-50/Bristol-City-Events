from functools import wraps
from datetime import date, timedelta
from io import BytesIO

from flask import (
    Flask, render_template, request, redirect,
    url_for, session, flash, jsonify, send_file
)
from flask_socketio import SocketIO, emit
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from db.connection import execute_query
from db.user_model import create_user, verify_user, get_user_by_email
from db.event_model import get_all_events, get_event
from db.booking_model import create_booking, add_to_waiting_list, cancel_booking


app = Flask(__name__)
app.secret_key = "change-this-secret-key"
app.config["PROPAGATE_EXCEPTIONS"] = True

socketio = SocketIO(app, cors_allowed_origins="*")


# ═══════════════════════════════════════════════
#  DECORATORS
# ═══════════════════════════════════════════════

def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Please log in first.", "error")
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)
    return wrapper


def admin_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Please log in first.", "error")
            return redirect(url_for("login"))
        # ── FIX: redirect to login (not home) so the flash message is visible
        #         and the user knows exactly what went wrong
        if session.get("role") != "admin":
            flash(
                f"Admin access only. Your current role is: '{session.get('role')}'. "
                "Contact an administrator if this is wrong.",
                "error"
            )
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)
    return wrapper


# ── FIX: inject current_user_id so admin.html can use it in Jinja2
#         instead of calling session.get('user_id') which Flask does NOT
#         expose to templates by default
@app.context_processor
def inject_session_data():
    return {
        "is_logged_in":      "user_id" in session,
        "current_user_name": session.get("username"),
        "current_user_role": session.get("role"),
        "current_user_id":   session.get("user_id"),   # ← added
    }


# ═══════════════════════════════════════════════
#  HEALTH / DEBUG
# ═══════════════════════════════════════════════

@app.route("/health")
def health():
    return jsonify({"status": "OK"})


@app.route("/test-db")
def test_db():
    result = execute_query("SELECT 1 AS test", fetchone=True)
    return jsonify({"status": "OK", "result": result})


# ── FIX: debug route — visit /debug/session to inspect what is
#         stored in the session right now. Remove before going live.
@app.route("/debug/session")
def debug_session():
    return jsonify({
        "user_id":   session.get("user_id"),
        "username":  session.get("username"),
        "role":      session.get("role"),
        "is_student": session.get("is_student"),
    })


# ═══════════════════════════════════════════════
#  PUBLIC
# ═══════════════════════════════════════════════

@app.route("/")
def home():
    try:
        events = get_all_events() or []
    except Exception:
        events = []
    return render_template("index.html", events=events)


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/explore")
def explore():
    return render_template("explore.html")


@app.route("/contact", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        name    = request.form.get("name", "").strip()
        email   = request.form.get("email", "").strip()
        message = request.form.get("message", "").strip()

        if not name or not email or not message:
            flash("Please complete all contact form fields.", "error")
            return render_template("contact.html")

        ok = execute_query(
            "INSERT INTO contacts (name, email, message) VALUES (%s, %s, %s)",
            (name, email, message), commit=True
        )
        if ok:
            flash("Message sent successfully.", "success")
            return redirect(url_for("contact"))
        flash("Unable to send message right now.", "error")

    return render_template("contact.html")


@app.route("/events")
def events():
    category_id = request.args.get("category_id", type=int)
    venue_id    = request.args.get("venue_id", type=int)
    free_only   = request.args.get("free_only")

    query  = """
        SELECT e.*, v.venue_name, c.category_name
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        WHERE 1=1
    """
    params = []

    if category_id:
        query += " AND e.category_id = %s"; params.append(category_id)
    if venue_id:
        query += " AND e.venue_id = %s";    params.append(venue_id)
    if free_only == "1":
        query += " AND e.base_price = 0"

    query += " ORDER BY e.start_datetime ASC"

    events_data = execute_query(query, tuple(params), fetchall=True) or []
    categories  = execute_query("SELECT * FROM event_categories ORDER BY category_name ASC", fetchall=True) or []
    venues      = execute_query("SELECT * FROM venues WHERE is_active = TRUE ORDER BY venue_name ASC", fetchall=True) or []

    return render_template("events.html", events=events_data, categories=categories, venues=venues)


@app.route("/events/<int:event_id>")
def event_details(event_id):
    event = execute_query(
        """
        SELECT e.*, v.venue_name, v.address, v.capacity, c.category_name
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        WHERE e.event_id = %s
        """,
        (event_id,), fetchone=True
    )
    if not event:
        flash("Event not found.", "error")
        return redirect(url_for("events"))

    event_days = execute_query(
        "SELECT * FROM event_days WHERE event_id = %s ORDER BY event_date ASC",
        (event_id,), fetchall=True
    ) or []

    return render_template("event_details.html", event=event, event_days=event_days)




@socketio.on("new_booking")
def handle_booking(data):
    emit("booking_update", data, broadcast=True)



#  AUTH


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "").strip()

        if not email or not password:
            flash("Email and password are required.", "error")
            return render_template("login.html", show_register=False)

        user = verify_user(email, password)

        # ── FIX: guard against verify_user returning something that
        #         doesn't have a 'role' key (e.g. a tuple instead of a dict,
        #         or a model that doesn't select the role column)
        if not user:
            flash("Invalid email or password.", "error")
            return render_template("login.html", show_register=False)

        if "role" not in user:
            app.logger.error(
                "verify_user() returned a user object without a 'role' key: %s. "
                "Check your db/user_model.py SELECT statement.", dict(user)
            )
            flash("Login error: user record is missing role. Contact support.", "error")
            return render_template("login.html", show_register=False)

        session["user_id"]    = user["user_id"]
        session["username"]   = user["username"]
        session["email"]      = user["email"]
        session["role"]       = user["role"]          # must be 'admin' or 'standard_user'
        session["is_student"] = bool(user.get("is_student", False))

        app.logger.info(
            "Login: user_id=%s username=%s role=%s",
            user["user_id"], user["username"], user["role"]
        )

        flash("Login successful.", "success")

        if user["role"] == "admin":
            return redirect(url_for("admin_dashboard"))
        return redirect(url_for("userpanel"))

    return render_template("login.html", show_register=False)


@app.route("/register", methods=["POST"])
def register():
    username   = request.form.get("username", "").strip()
    email      = request.form.get("email", "").strip().lower()
    password   = request.form.get("password", "").strip()
    is_student = request.form.get("is_student") == "on"

    if not username or not email or not password:
        flash("All registration fields are required.", "error")
        return render_template("login.html", show_register=True)

    if len(password) < 6:
        flash("Password must be at least 6 characters.", "error")
        return render_template("login.html", show_register=True)

    if get_user_by_email(email):
        flash("That email is already registered.", "error")
        return render_template("login.html", show_register=True)

    if not create_user(username, email, password, is_student):
        flash("Registration failed.", "error")
        return render_template("login.html", show_register=True)

    flash("Account created. Please log in.", "success")
    return render_template("login.html", show_register=False)


@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.", "success")
    return redirect(url_for("home"))



#  USER PANEL


@app.route("/userpanel")
@login_required
def userpanel():
    uid = session["user_id"]

    bookings_raw = execute_query(
        """
        SELECT b.booking_id, b.booking_status, b.final_price, b.receipt_code,
               e.event_name, e.start_datetime, v.venue_name
        FROM bookings b
        JOIN events e ON b.event_id = e.event_id
        JOIN venues v ON e.venue_id = v.venue_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC
        """,
        (uid,), fetchall=True
    ) or []

    tickets       = []
    notifications = []

    for b in bookings_raw:
        tickets.append({
            "id":           b["receipt_code"] or f"RCPT-{b['booking_id']}",
            "event":        b["event_name"],
            "seat_ref":     "General",
            "date":         b["start_datetime"].strftime("%Y-%m-%d") if b["start_datetime"] else "",
            "venue":        b["venue_name"],
            "receipt_code": b["receipt_code"] or "",
        })
        notifications.append(
            f"Booking #{b['booking_id']} for {b['event_name']} is {b['booking_status']}."
        )

    events_rows = execute_query(
        """
        SELECT e.event_id AS id,
               e.event_name AS title,
               e.start_datetime,
               v.venue_name AS venue,
               e.base_price AS price,
               e.total_tickets AS capacity,
               e.remaining_tickets,
               e.status,
               c.category_name AS category
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        ORDER BY e.start_datetime ASC
        """,
        fetchall=True
    ) or []

    normalized_events = []
    for row in events_rows:
        normalized_events.append({
            "id":                row["id"],
            "title":             row["title"],
            "date":              row["start_datetime"].strftime("%Y-%m-%d") if row["start_datetime"] else "",
            "venue":             row["venue"],
            "price":             float(row["price"]),
            "status":            row["status"],
            "capacity":          row["capacity"],
            "remaining_tickets": row.get("remaining_tickets") or 0,
            "category":          row.get("category") or "general",
        })

    transactions = execute_query(
        """
        SELECT b.booking_id, b.final_price AS amount, b.booking_status AS status,
               b.receipt_code, b.created_at AS date, e.event_name AS event
        FROM bookings b
        JOIN events e ON b.event_id = e.event_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC
        """,
        (uid,), fetchall=True
    ) or []

    serialised_tx = []
    for t in transactions:
        serialised_tx.append({
            "event":        t["event"],
            "amount":       float(t["amount"]),
            "status":       t["status"],
            "receipt_code": t["receipt_code"] or "",
            "date":         t["date"].strftime("%Y-%m-%d") if t["date"] else "",
        })

    return render_template(
        "userpanel.html",
        user={
            "id":         uid,
            "name":       session.get("username", "Guest"),
            "is_student": session.get("is_student", False),
        },
        tickets=tickets,
        notifications=notifications,
        events=normalized_events,
        transactions=serialised_tx,
    )


@app.route("/profile/bookings")
@login_required
def profile_bookings():
    bookings = execute_query(
        """
        SELECT b.*, e.event_name, e.start_datetime, e.end_datetime
        FROM bookings b
        JOIN events e ON b.event_id = e.event_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC
        """,
        (session["user_id"],), fetchall=True
    ) or []
    return render_template("profile_bookings.html", bookings=bookings)


@app.route("/booking/<int:event_id>", methods=["GET", "POST"])
@login_required
def booking(event_id):
    event = get_event(event_id)
    if not event:
        flash("Event not found.", "error")
        return redirect(url_for("events"))

    if request.method == "POST":
        quantity = request.form.get("quantity", type=int, default=1)
        if quantity < 1:
            flash("Invalid ticket quantity.", "error")
            return redirect(url_for("booking", event_id=event_id))

        result = create_booking(
            user={"user_id": session["user_id"], "is_student": session.get("is_student", False)},
            event=event,
            num_tickets=quantity
        )

        if result == "WAITING_LIST":
            add_to_waiting_list(session["user_id"], event_id)
            flash("Event full. You were added to the waiting list.", "info")
            return redirect(url_for("event_details", event_id=event_id))

        latest = execute_query(
            "SELECT booking_id FROM bookings WHERE user_id = %s AND event_id = %s ORDER BY booking_id DESC LIMIT 1",
            (session["user_id"], event_id), fetchone=True
        )
        flash("Booking successful.", "success")
        return redirect(url_for("receipt", booking_id=latest["booking_id"]))

    event_days = execute_query(
        "SELECT * FROM event_days WHERE event_id = %s ORDER BY event_date ASC",
        (event_id,), fetchall=True
    ) or []
    return render_template("booking.html", event=event, event_days=event_days)


@app.route("/booking/<int:booking_id>/cancel", methods=["POST"])
@login_required
def cancel_user_booking(booking_id):
    booking = execute_query(
        "SELECT * FROM bookings WHERE booking_id = %s AND user_id = %s",
        (booking_id, session["user_id"]), fetchone=True
    )
    if not booking:
        flash("Booking not found.", "error")
        return redirect(url_for("profile_bookings"))

    if cancel_booking(booking_id):
        execute_query(
            "UPDATE events SET remaining_tickets = remaining_tickets + %s WHERE event_id = %s",
            (booking["num_tickets"], booking["event_id"]), commit=True
        )
        flash("Booking cancelled.", "success")
    else:
        flash("Unable to cancel booking.", "error")

    return redirect(url_for("profile_bookings"))


@app.route("/receipt/<int:booking_id>")
@login_required
def receipt(booking_id):
    receipt_data = execute_query(
        """
        SELECT b.*, u.username, u.email, e.event_name, e.start_datetime, v.venue_name
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN events e ON b.event_id = e.event_id
        JOIN venues v ON e.venue_id = v.venue_id
        WHERE b.booking_id = %s AND b.user_id = %s
        """,
        (booking_id, session["user_id"]), fetchone=True
    )
    if not receipt_data:
        flash("Receipt not found.", "error")
        return redirect(url_for("profile_bookings"))
    return render_template("receipt.html", receipt=receipt_data)


@app.route("/receipt/<int:booking_id>/pdf")
@login_required
def generate_receipt_pdf(booking_id):
    receipt_data = execute_query(
        """
        SELECT b.*, u.username, u.email, e.event_name, e.start_datetime, v.venue_name
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN events e ON b.event_id = e.event_id
        JOIN venues v ON e.venue_id = v.venue_id
        WHERE b.booking_id = %s AND b.user_id = %s
        """,
        (booking_id, session["user_id"]), fetchone=True
    )
    if not receipt_data:
        flash("Receipt not found.", "error")
        return redirect(url_for("profile_bookings"))

    buffer   = BytesIO()
    doc      = SimpleDocTemplate(buffer)
    styles   = getSampleStyleSheet()
    dt       = receipt_data["start_datetime"]
    date_str = dt.strftime("%d %b %Y %H:%M") if dt else "TBA"

    elements = [
        Paragraph("Bristol City Events — Receipt", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Booking ID: {receipt_data['booking_id']}", styles["Normal"]),
        Paragraph(f"Event: {receipt_data['event_name']}", styles["Normal"]),
        Paragraph(f"Date: {date_str}", styles["Normal"]),
        Paragraph(f"Venue: {receipt_data['venue_name']}", styles["Normal"]),
        Paragraph(f"Tickets: {receipt_data['num_tickets']}", styles["Normal"]),
        Paragraph(f"Total Paid: £{float(receipt_data['final_price']):.2f}", styles["Normal"]),
        Spacer(1, 12),
        Paragraph(f"Name: {receipt_data['username']}", styles["Normal"]),
        Paragraph(f"Email: {receipt_data['email']}", styles["Normal"]),
    ]
    doc.build(elements)
    buffer.seek(0)
    return send_file(
        buffer, as_attachment=True,
        download_name=f"receipt_{booking_id}.pdf",
        mimetype="application/pdf"
    )



#  WALLET


@app.route("/wallet/add", methods=["POST"])
@login_required
def add_funds():
    amount = float((request.json or {}).get("amount", 0))
    ok = execute_query(
        "UPDATE wallet SET balance = balance + %s WHERE user_id = %s",
        (amount, session["user_id"]), commit=True
    )
    return jsonify({"status": "ok" if ok else "error"})



#  ADMIN DASHBOARD


@app.route("/admin")
@admin_required
def admin_dashboard():
    users_data = execute_query(
        """
        SELECT user_id AS id, username AS name, email, role,
               is_student, created_at
        FROM users
        ORDER BY created_at DESC
        """,
        fetchall=True
    ) or []

    events_raw = execute_query(
        """
        SELECT e.event_id AS id,
               e.event_name AS title,
               v.venue_name AS venue,
               c.category_name AS category,
               DATE_FORMAT(e.start_datetime, '%%Y-%%m-%%d %%H:%%i') AS date,
               e.base_price AS price,
               e.total_tickets AS capacity,
               e.remaining_tickets,
               e.status,
               e.description,
               e.category_id,
               e.venue_id
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        ORDER BY e.start_datetime DESC
        """,
        fetchall=True
    ) or []

    bookings_data = execute_query(
        """
        SELECT b.booking_id AS id,
               u.username AS user,
               u.email AS user_email,
               e.event_name AS event,
               DATE_FORMAT(e.start_datetime, '%%Y-%%m-%%d') AS date,
               b.booking_status AS status,
               b.final_price AS amount,
               b.num_tickets,
               b.receipt_code,
               b.created_at
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN events e ON b.event_id = e.event_id
        ORDER BY b.created_at DESC
        """,
        fetchall=True
    ) or []

    venues_data = execute_query(
        """
        SELECT venue_id AS id, venue_name AS name,
               address, capacity, suitable_for, is_active
        FROM venues
        ORDER BY venue_name ASC
        """,
        fetchall=True
    ) or []

    categories_data = execute_query(
        "SELECT category_id, category_name FROM event_categories ORDER BY category_name ASC",
        fetchall=True
    ) or []

    waiting_data = execute_query(
        """
        SELECT w.waiting_list_id, u.username, u.email,
               e.event_name, w.created_at
        FROM waiting_list w
        JOIN users u ON w.user_id = u.user_id
        JOIN events e ON w.event_id = e.event_id
        ORDER BY w.created_at ASC
        """,
        fetchall=True
    ) or []

    logs_data = execute_query(
        """
        SELECT l.log_id, u.username AS admin, l.action, l.created_at
        FROM admin_logs l
        JOIN users u ON l.admin_id = u.user_id
        ORDER BY l.created_at DESC
        LIMIT 50
        """,
        fetchall=True
    ) or []

    total_revenue  = execute_query(
        "SELECT COALESCE(SUM(final_price), 0) AS total FROM bookings WHERE booking_status = 'confirmed'",
        fetchone=True
    )
    total_users    = execute_query("SELECT COUNT(*) AS cnt FROM users", fetchone=True)
    total_bookings = execute_query("SELECT COUNT(*) AS cnt FROM bookings", fetchone=True)
    total_events   = execute_query("SELECT COUNT(*) AS cnt FROM events WHERE status='upcoming'", fetchone=True)
    student_count  = execute_query(
        "SELECT COUNT(*) AS cnt FROM users WHERE is_student = 1", fetchone=True
    )
    waiting_count  = execute_query("SELECT COUNT(*) AS cnt FROM waiting_list", fetchone=True)

    revenue_per_event = execute_query(
        """
        SELECT e.event_name,
               COALESCE(SUM(b.final_price), 0) AS total_revenue,
               COUNT(b.booking_id) AS total_bookings
        FROM events e
        LEFT JOIN bookings b ON e.event_id = b.event_id AND b.booking_status = 'confirmed'
        GROUP BY e.event_id, e.event_name
        ORDER BY total_revenue DESC
        """,
        fetchall=True
    ) or []

    venue_usage = execute_query(
        """
        SELECT v.venue_name, COUNT(e.event_id) AS total_events
        FROM venues v
        LEFT JOIN events e ON v.venue_id = e.venue_id
        GROUP BY v.venue_id, v.venue_name
        ORDER BY total_events DESC
        """,
        fetchall=True
    ) or []

    def _s(rows):
        out = []
        for row in rows:
            r = dict(row)
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = str(v)
            out.append(r)
        return out

    events_data = []
    for e in events_raw:
        events_data.append({
            "id":                e["id"],
            "title":             e["title"],
            "venue":             e["venue"],
            "venue_id":          e["venue_id"],
            "category":          e["category"],
            "category_id":       e["category_id"],
            "date":              e["date"] or "",
            "price":             float(e["price"]),
            "capacity":          e["capacity"],
            "remaining_tickets": e.get("remaining_tickets") or 0,
            "status":            e["status"],
            "description":       e.get("description") or "",
        })

    return render_template(
        "admin.html",
        users=_s(users_data),
        events=events_data,
        bookings=_s(bookings_data),
        venues=_s(venues_data),
        categories=categories_data,
        waiting_list=_s(waiting_data),
        logs=_s(logs_data),
        revenue_per_event=revenue_per_event,
        venue_usage=venue_usage,
        total_revenue=float(total_revenue["total"]) if total_revenue else 0.0,
        total_users=total_users["cnt"] if total_users else 0,
        total_bookings=total_bookings["cnt"] if total_bookings else 0,
        total_events=total_events["cnt"] if total_events else 0,
        student_count=student_count["cnt"] if student_count else 0,
        waiting_count=waiting_count["cnt"] if waiting_count else 0,
    )


# ── ADD EVENT ───────────────────────────────────────────────────
@app.route("/admin/events/add", methods=["POST"])
@admin_required
def admin_add_event():
    event_name        = request.form.get("event_name", "").strip()
    category_id       = request.form.get("category_id", type=int)
    description       = request.form.get("description", "").strip()
    venue_id          = request.form.get("venue_id", type=int)
    start_datetime    = request.form.get("start_datetime", "").strip()
    end_datetime      = request.form.get("end_datetime", "").strip()
    base_price        = request.form.get("base_price", type=float, default=0.0)
    total_tickets     = request.form.get("total_tickets", type=int, default=0)
    last_booking_date = request.form.get("last_booking_date", "").strip()
    is_multi_day      = 1 if request.form.get("is_multi_day") == "on" else 0

    if not all([event_name, category_id, venue_id, start_datetime, end_datetime, last_booking_date]):
        flash("Please complete all required fields.", "error")
        return redirect(url_for("admin_dashboard") + "#events")

    ok = execute_query(
        """
        INSERT INTO events (
            event_name, category_id, description, venue_id,
            start_datetime, end_datetime, base_price,
            total_tickets, remaining_tickets, last_booking_date,
            is_multi_day, status
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'upcoming')
        """,
        (event_name, category_id, description, venue_id,
         start_datetime, end_datetime, base_price,
         total_tickets, total_tickets, last_booking_date, is_multi_day),
        commit=True
    )
    if ok:
        execute_query(
            "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
            (session["user_id"], f"Added event: {event_name}"), commit=True
        )
        flash(f"Event '{event_name}' added.", "success")
    else:
        flash("Failed to add event.", "error")
    return redirect(url_for("admin_dashboard") + "#events")


# ── EDIT EVENT ──────────────────────────────────────────────────
@app.route("/admin/events/<int:event_id>/edit", methods=["POST"])
@admin_required
def admin_edit_event(event_id):
    event_name        = request.form.get("event_name", "").strip()
    category_id       = request.form.get("category_id", type=int)
    venue_id          = request.form.get("venue_id", type=int)
    start_datetime    = request.form.get("start_datetime", "").strip()
    end_datetime      = request.form.get("end_datetime", "").strip()
    base_price        = request.form.get("base_price", type=float, default=0.0)
    total_tickets     = request.form.get("total_tickets", type=int, default=0)
    description       = request.form.get("description", "").strip()
    last_booking_date = request.form.get("last_booking_date", "").strip()

    booked = execute_query(
        "SELECT COALESCE(SUM(num_tickets),0) AS booked FROM bookings WHERE event_id=%s AND booking_status='confirmed'",
        (event_id,), fetchone=True
    )
    booked_count  = int(booked["booked"]) if booked else 0
    new_remaining = max(0, total_tickets - booked_count)

    execute_query(
        """
        UPDATE events SET
            event_name=%s, category_id=%s, venue_id=%s,
            start_datetime=%s, end_datetime=%s,
            base_price=%s, total_tickets=%s, remaining_tickets=%s,
            description=%s, last_booking_date=%s
        WHERE event_id=%s
        """,
        (event_name, category_id, venue_id, start_datetime, end_datetime,
         base_price, total_tickets, new_remaining, description, last_booking_date, event_id),
        commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Edited event ID {event_id}: {event_name}"), commit=True
    )
    flash(f"Event '{event_name}' updated.", "success")
    return redirect(url_for("admin_dashboard") + "#events")


# ── ADJUST CAPACITY ─────────────────────────────────────────────
@app.route("/admin/events/<int:event_id>/capacity", methods=["POST"])
@admin_required
def admin_adjust_capacity(event_id):
    new_capacity = request.form.get("total_tickets", type=int)
    if not new_capacity or new_capacity < 1:
        flash("Invalid capacity.", "error")
        return redirect(url_for("admin_dashboard") + "#events")

    booked = execute_query(
        "SELECT COALESCE(SUM(num_tickets),0) AS booked FROM bookings WHERE event_id=%s AND booking_status='confirmed'",
        (event_id,), fetchone=True
    )
    booked_count  = int(booked["booked"]) if booked else 0
    new_remaining = max(0, new_capacity - booked_count)

    execute_query(
        "UPDATE events SET total_tickets=%s, remaining_tickets=%s WHERE event_id=%s",
        (new_capacity, new_remaining, event_id), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Adjusted capacity of event {event_id} to {new_capacity}"), commit=True
    )
    flash(f"Capacity updated to {new_capacity} ({new_remaining} remaining).", "success")
    return redirect(url_for("admin_dashboard") + "#events")


# ── EVENT STATUS ────────────────────────────────────────────────
@app.route("/admin/events/<int:event_id>/status", methods=["POST"])
@admin_required
def admin_update_event_status(event_id):
    new_status = request.form.get("status", "upcoming")
    execute_query(
        "UPDATE events SET status=%s WHERE event_id=%s", (new_status, event_id), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Set event {event_id} status → {new_status}"), commit=True
    )
    flash(f"Status updated to {new_status}.", "success")
    return redirect(url_for("admin_dashboard") + "#events")


# ── DELETE EVENT ────────────────────────────────────────────────
@app.route("/admin/events/<int:event_id>/delete", methods=["POST"])
@admin_required
def admin_delete_event(event_id):
    event = execute_query("SELECT event_name FROM events WHERE event_id=%s", (event_id,), fetchone=True)
    execute_query("DELETE FROM events WHERE event_id=%s", (event_id,), commit=True)
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Deleted event: {event['event_name'] if event else event_id}"), commit=True
    )
    flash("Event deleted.", "success")
    return redirect(url_for("admin_dashboard") + "#events")


# ── ADD VENUE ───────────────────────────────────────────────────
@app.route("/admin/venues/add", methods=["POST"])
@admin_required
def admin_add_venue():
    venue_name   = request.form.get("venue_name", "").strip()
    address      = request.form.get("address", "").strip()
    capacity     = request.form.get("capacity", type=int, default=0)
    suitable_for = request.form.get("suitable_for", "").strip()
    if not venue_name or not address or capacity <= 0:
        flash("Invalid venue data.", "error")
        return redirect(url_for("admin_dashboard") + "#venues")
    ok = execute_query(
        "INSERT INTO venues (venue_name, address, capacity, suitable_for) VALUES (%s,%s,%s,%s)",
        (venue_name, address, capacity, suitable_for), commit=True
    )
    flash(
        f"Venue '{venue_name}' added." if ok else "Failed to add venue.",
        "success" if ok else "error"
    )
    return redirect(url_for("admin_dashboard") + "#venues")


# ── ADD CATEGORY ────────────────────────────────────────────────
@app.route("/admin/categories/add", methods=["POST"])
@admin_required
def admin_add_category():
    name = request.form.get("category_name", "").strip()
    if not name:
        flash("Category name required.", "error")
        return redirect(url_for("admin_dashboard") + "#events")
    ok = execute_query(
        "INSERT INTO event_categories (category_name) VALUES (%s)", (name,), commit=True
    )
    flash(f"Category '{name}' added." if ok else "Failed.", "success" if ok else "error")
    return redirect(url_for("admin_dashboard") + "#events")


# ── CANCEL BOOKING ──────────────────────────────────────────────
@app.route("/admin/bookings/<int:booking_id>/cancel", methods=["POST"])
@admin_required
def admin_cancel_booking(booking_id):
    booking = execute_query(
        "SELECT * FROM bookings WHERE booking_id=%s", (booking_id,), fetchone=True
    )
    if not booking:
        flash("Booking not found.", "error")
        return redirect(url_for("admin_dashboard") + "#bookings")
    execute_query(
        "UPDATE bookings SET booking_status='cancelled' WHERE booking_id=%s",
        (booking_id,), commit=True
    )
    execute_query(
        "UPDATE events SET remaining_tickets=remaining_tickets+%s WHERE event_id=%s",
        (booking["num_tickets"], booking["event_id"]), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Cancelled booking #{booking_id}"), commit=True
    )
    flash(f"Booking #{booking_id} cancelled.", "success")
    return redirect(url_for("admin_dashboard") + "#bookings")


# ── REFUND BOOKING ──────────────────────────────────────────────
@app.route("/admin/bookings/<int:booking_id>/refund", methods=["POST"])
@admin_required
def admin_refund_booking(booking_id):
    booking = execute_query(
        "SELECT * FROM bookings WHERE booking_id=%s", (booking_id,), fetchone=True
    )
    if not booking:
        flash("Booking not found.", "error")
        return redirect(url_for("admin_dashboard") + "#bookings")
    execute_query(
        "UPDATE bookings SET booking_status='refunded', final_price=0 WHERE booking_id=%s",
        (booking_id,), commit=True
    )
    execute_query(
        "UPDATE events SET remaining_tickets=remaining_tickets+%s WHERE event_id=%s",
        (booking["num_tickets"], booking["event_id"]), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Refunded booking #{booking_id}"), commit=True
    )
    flash(f"Booking #{booking_id} refunded.", "success")
    return redirect(url_for("admin_dashboard") + "#bookings")


# ── UPDATE USER ROLE ────────────────────────────────────────────
@app.route("/admin/users/<int:user_id>/role", methods=["POST"])
@admin_required
def admin_update_user_role(user_id):
    new_role = request.form.get("role", "standard_user")
    execute_query(
        "UPDATE users SET role=%s WHERE user_id=%s", (new_role, user_id), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Set user {user_id} role → {new_role}"), commit=True
    )
    flash(f"Role updated to {new_role}.", "success")
    return redirect(url_for("admin_dashboard") + "#users")


# ── TOGGLE STUDENT STATUS ───────────────────────────────────────
@app.route("/admin/users/<int:user_id>/student", methods=["POST"])
@admin_required
def admin_toggle_student(user_id):
    current = execute_query(
        "SELECT is_student FROM users WHERE user_id=%s", (user_id,), fetchone=True
    )
    if not current:
        flash("User not found.", "error")
        return redirect(url_for("admin_dashboard") + "#users")
    new_val = 0 if current["is_student"] else 1
    execute_query(
        "UPDATE users SET is_student=%s WHERE user_id=%s", (new_val, user_id), commit=True
    )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Set user {user_id} is_student → {new_val}"), commit=True
    )
    flash(f"Student status {'granted' if new_val else 'removed'}.", "success")
    return redirect(url_for("admin_dashboard") + "#users")


# ── DELETE USER ─────────────────────────────────────────────────
@app.route("/admin/users/<int:user_id>/delete", methods=["POST"])
@admin_required
def admin_delete_user(user_id):
    if user_id == session.get("user_id"):
        flash("Cannot delete your own account.", "error")
        return redirect(url_for("admin_dashboard") + "#users")
    user = execute_query(
        "SELECT username FROM users WHERE user_id=%s", (user_id,), fetchone=True
    )
    execute_query("DELETE FROM users WHERE user_id=%s", (user_id,), commit=True)
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Deleted user: {user['username'] if user else user_id}"), commit=True
    )
    flash("User deleted.", "success")
    return redirect(url_for("admin_dashboard") + "#users")


# ── ADD USER (admin-side) ───────────────────────────────────────
@app.route("/admin/users/add", methods=["POST"])
@admin_required
def admin_add_user():
    username   = request.form.get("username", "").strip()
    email      = request.form.get("email", "").strip().lower()
    password   = request.form.get("password", "").strip()
    role       = request.form.get("role", "standard_user")
    is_student = 1 if request.form.get("is_student") == "on" else 0

    if not username or not email or not password:
        flash("All fields required.", "error")
        return redirect(url_for("admin_dashboard") + "#users")

    if get_user_by_email(email):
        flash("Email already registered.", "error")
        return redirect(url_for("admin_dashboard") + "#users")

    ok = create_user(username, email, password, is_student)
    if ok and role == "admin":
        u = get_user_by_email(email)
        if u:
            execute_query(
                "UPDATE users SET role='admin' WHERE user_id=%s", (u["user_id"],), commit=True
            )
    execute_query(
        "INSERT INTO admin_logs (admin_id, action) VALUES (%s, %s)",
        (session["user_id"], f"Created user: {username} ({role})"), commit=True
    )
    flash(
        f"User '{username}' created." if ok else "Failed to create user.",
        "success" if ok else "error"
    )
    return redirect(url_for("admin_dashboard") + "#users")


# ── ADMIN REPORTS (redirect to dashboard tab) ───────────────────
@app.route("/admin/reports")
@admin_required
def admin_reports():
    return redirect(url_for("admin_dashboard") + "#reports")


# ── API: ADMIN STATS ────────────────────────────────────────────
@app.route("/api/admin/stats")
@admin_required
def api_admin_stats():
    revenue = execute_query(
        "SELECT COALESCE(SUM(final_price),0) AS total FROM bookings WHERE booking_status='confirmed'",
        fetchone=True
    )
    bookings_by_day = execute_query(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS cnt
        FROM bookings
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
        """,
        fetchall=True
    ) or []

    day_map  = {str(r["day"]): r["cnt"] for r in bookings_by_day}
    all_days = [(date.today() - timedelta(days=29 - i)) for i in range(30)]
    labels   = [d.strftime("%d %b") for d in all_days]
    values   = [day_map.get(str(d), 0) for d in all_days]

    return jsonify({
        "revenue": float(revenue["total"]) if revenue else 0,
        "chart":   {"labels": labels, "values": values},
    })


# ── API: SEARCH EVENTS ──────────────────────────────────────────
@app.route("/api/admin/events")
@admin_required
def api_admin_events():
    category = request.args.get("category", "")
    q        = request.args.get("q", "")
    status   = request.args.get("status", "")
    params   = []

    query = """
        SELECT e.event_id AS id, e.event_name AS title,
               DATE_FORMAT(e.start_datetime,'%%Y-%%m-%%d') AS date,
               v.venue_name AS venue, e.base_price AS price,
               e.remaining_tickets, e.total_tickets AS capacity,
               e.status, c.category_name AS category
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        WHERE 1=1
    """
    if category:
        query += " AND c.category_name = %s"; params.append(category)
    if q:
        query += " AND (e.event_name LIKE %s OR v.venue_name LIKE %s)"
        params += [f"%{q}%", f"%{q}%"]
    if status:
        query += " AND e.status = %s"; params.append(status)

    query += " ORDER BY e.start_datetime DESC LIMIT 100"
    rows = execute_query(query, params, fetchall=True) or []
    return jsonify([{
        "id":                r["id"],
        "title":             r["title"],
        "date":              r["date"],
        "venue":             r["venue"],
        "price":             float(r["price"]),
        "remaining_tickets": r["remaining_tickets"] or 0,
        "capacity":          r["capacity"],
        "status":            r["status"],
        "category":          r["category"],
    } for r in rows])


# ═══════════════════════════════════════════════
#  JSON API
# ═══════════════════════════════════════════════

@app.route("/api/events")
def api_events():
    category = request.args.get("category")
    q        = request.args.get("q")
    params   = []

    query = """
        SELECT e.event_id AS id, e.event_name AS title,
               DATE_FORMAT(e.start_datetime, '%%Y-%%m-%%d') AS date,
               v.venue_name AS venue, e.base_price AS price,
               e.remaining_tickets, c.category_name AS category
        FROM events e
        JOIN venues v ON e.venue_id = v.venue_id
        JOIN event_categories c ON e.category_id = c.category_id
        WHERE e.start_datetime >= NOW()
    """
    if category:
        query += " AND c.category_name = %s"; params.append(category)
    if q:
        query += " AND (e.event_name LIKE %s OR v.venue_name LIKE %s)"
        params += [f"%{q}%", f"%{q}%"]

    query += " ORDER BY e.start_datetime ASC LIMIT 30"
    rows = execute_query(query, params, fetchall=True) or []

    return jsonify([{
        "id":                r["id"],
        "title":             r["title"],
        "date":              r["date"] or "",
        "venue":             r["venue"],
        "price":             float(r["price"]),
        "remaining_tickets": r.get("remaining_tickets") or 0,
        "category":          r["category"] or "general",
    } for r in rows])


@app.route("/api/me")
@login_required
def api_me():
    return jsonify({
        "user_id":    session.get("user_id"),
        "username":   session.get("username"),
        "role":       session.get("role"),
        "is_student": session.get("is_student"),
    })


@app.route("/api/stats")
@login_required
def api_stats():
    uid = session["user_id"]

    ticket_count = execute_query(
        "SELECT COUNT(*) AS c FROM bookings WHERE user_id = %s AND booking_status = 'confirmed'",
        (uid,), fetchone=True
    )
    total_spend = execute_query(
        "SELECT COALESCE(SUM(final_price), 0) AS s FROM bookings WHERE user_id = %s AND booking_status = 'confirmed'",
        (uid,), fetchone=True
    )
    event_count = execute_query(
        "SELECT COUNT(*) AS c FROM events WHERE start_datetime >= NOW()",
        fetchone=True
    )

    return jsonify({
        "tickets":       ticket_count["c"] if ticket_count else 0,
        "events":        event_count["c"]  if event_count  else 0,
        "notifications": 0,
        "spend":         float(total_spend["s"]) if total_spend else 0.0,
    })


@app.route("/api/activity")
@login_required
def api_activity():
    uid = session["user_id"]

    daily = execute_query(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS bookings
        FROM bookings
        WHERE user_id = %s AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
        """,
        (uid,), fetchall=True
    ) or []

    day_map  = {str(r["day"]): r["bookings"] for r in daily}
    all_days = [(date.today() - timedelta(days=29 - i)) for i in range(30)]
    labels   = [d.strftime("%d %b") for d in all_days]
    values   = [day_map.get(str(d), 0) for d in all_days]

    return jsonify({"labels": labels, "values": values})


@app.route("/api/book", methods=["POST"])
@login_required
def api_book():
    data          = request.json or {}
    event_id      = data.get("event_id")
    num_tickets   = max(1, int(data.get("num_tickets", 1)))
    apply_student = data.get("student_discount", False)

    if not event_id:
        return jsonify({"error": "Missing event_id"}), 400

    event = execute_query("SELECT * FROM events WHERE event_id = %s", (event_id,), fetchone=True)
    if not event:
        return jsonify({"error": "Event not found"}), 404

    gross = float(event["base_price"]) * num_tickets
    final = round(gross * 0.90, 2) if (apply_student and session.get("is_student")) else round(gross, 2)

    if (event.get("remaining_tickets") or 0) < num_tickets:
        add_to_waiting_list(session["user_id"], event_id)
        return jsonify({"status": "WAITING_LIST"})

    execute_query(
        """
        INSERT INTO bookings
            (user_id, event_id, num_tickets, gross_price, final_price, receipt_code, booking_status)
        VALUES (%s, %s, %s, %s, %s, UUID(), 'confirmed')
        """,
        (session["user_id"], event_id, num_tickets, gross, final), commit=True
    )
    execute_query(
        "UPDATE events SET remaining_tickets = remaining_tickets - %s WHERE event_id = %s",
        (num_tickets, event_id), commit=True
    )

    new_booking = execute_query(
        """
        SELECT b.booking_id, b.receipt_code, b.final_price
        FROM bookings b
        WHERE b.user_id = %s AND b.event_id = %s
        ORDER BY b.booking_id DESC LIMIT 1
        """,
        (session["user_id"], event_id), fetchone=True
    )

    socketio.emit("booking_update", {
        "event_id": event_id,
        "title":    event.get("event_name"),
        "user":     session.get("username"),
    })

    return jsonify({
        "status": "BOOKED",
        "booking": {
            "booking_id":   new_booking["booking_id"]   if new_booking else None,
            "receipt_code": new_booking["receipt_code"] if new_booking else None,
            "final_price":  float(new_booking["final_price"]) if new_booking else final,
        }
    })


@app.route("/api/recommendations")
@login_required
def api_recommendations():
    uid = session["user_id"]

    past = execute_query(
        """
        SELECT e.category_id
        FROM bookings b
        JOIN events e ON b.event_id = e.event_id
        WHERE b.user_id = %s AND b.booking_status = 'confirmed'
        GROUP BY e.category_id
        ORDER BY COUNT(*) DESC LIMIT 3
        """,
        (uid,), fetchall=True
    ) or []

    cat_ids = [r["category_id"] for r in past if r.get("category_id")]

    if cat_ids:
        placeholders = ", ".join(["%s"] * len(cat_ids))
        recs = execute_query(
            f"""
            SELECT e.event_id AS id, e.event_name AS title,
                   DATE_FORMAT(e.start_datetime, '%%Y-%%m-%%d') AS date,
                   v.venue_name AS venue, e.base_price AS price,
                   c.category_name AS category
            FROM events e
            JOIN venues v ON e.venue_id = v.venue_id
            JOIN event_categories c ON e.category_id = c.category_id
            WHERE e.start_datetime >= NOW()
              AND e.category_id IN ({placeholders})
              AND e.event_id NOT IN (
                  SELECT event_id FROM bookings WHERE user_id = %s AND booking_status = 'confirmed'
              )
            ORDER BY e.start_datetime ASC LIMIT 4
            """,
            (*cat_ids, uid), fetchall=True
        )
    else:
        recs = execute_query(
            """
            SELECT e.event_id AS id, e.event_name AS title,
                   DATE_FORMAT(e.start_datetime, '%%Y-%%m-%%d') AS date,
                   v.venue_name AS venue, e.base_price AS price,
                   c.category_name AS category
            FROM events e
            JOIN venues v ON e.venue_id = v.venue_id
            JOIN event_categories c ON e.category_id = c.category_id
            WHERE e.start_datetime >= NOW()
              AND e.event_id NOT IN (
                  SELECT event_id FROM bookings WHERE user_id = %s
              )
            ORDER BY e.start_datetime ASC LIMIT 4
            """,
            (uid,), fetchall=True
        )

    return jsonify([{
        "id":       r["id"],
        "title":    r["title"],
        "date":     r["date"] or "",
        "venue":    r["venue"],
        "price":    float(r["price"]),
        "category": r["category"] or "general",
    } for r in (recs or [])])


@app.route("/api/notifications/read", methods=["POST"])
@login_required
def api_notifications_read():
    return jsonify({"status": "ok"})




if __name__ == "__main__":
    socketio.run(app, debug=True)