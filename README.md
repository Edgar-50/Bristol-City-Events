<div align="center">

# Bristol City Events

### Full-stack event discovery, booking, administration and analytics platform for Bristol.

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?style=for-the-badge&logo=flask&logoColor=white)](#)
[![MySQL](https://img.shields.io/badge/MySQL-PyMySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](#)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](#)
[![Render](https://img.shields.io/badge/Render-Deployment-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://bristol-city-events.onrender.com)

**BCE** brings event discovery, ticketing, user accounts, admin operations, receipts, waiting lists and reporting into one Flask application.

[Live Demo](https://bristol-city-events.onrender.com) • [Repository](https://github.com/Edgar-50/Bristol-City-Events)

</div>

---

## Homepage Preview

### Hero experience

<p align="center">
  <img src="docs/screenshots/homepage-hero.svg" alt="Bristol City Events homepage hero preview" width="100%">
</p>

### City highlights

<p align="center">
  <img src="docs/screenshots/homepage-highlights.svg" alt="Bristol City Events homepage highlights preview" width="100%">
</p>

The homepage combines the pill-style navigation, a cinematic YouTube-powered hero background, event discovery CTA, Bristol highlights, event statistics and responsive dark/light presentation.

---

## What BCE Does

Bristol City Events is more than a static event listing page. The application provides a complete workflow around discovering, booking and operating events.

| Area | Capability |
|---|---|
| Event discovery | Browse and explore Bristol events |
| Authentication | Registration, login and session-based access |
| Booking | Capacity-aware booking flow |
| Waiting lists | Queue users when events reach capacity |
| User dashboard | View bookings and account activity |
| Admin dashboard | Manage users, events and operational data |
| Realtime | Flask-SocketIO booking updates |
| Receipts | PDF receipt generation with ReportLab |
| Reporting | Booking, revenue and event analytics |
| Database | MySQL integration through PyMySQL |

---

## Architecture

```mermaid
flowchart LR
    U[Browser] --> F[Flask Application]
    F --> A[Authentication + Role Guards]
    F --> E[Event & Booking APIs]
    F --> S[Flask-SocketIO]
    F --> R[ReportLab PDF Receipts]
    E --> D[(MySQL)]
    A --> D
    S --> U
```

### Application layers

```text
Bristol-City-Events/
├── app.py
├── config.py
├── requirements.txt
├── db/
│   ├── connection.py
│   ├── user_model.py
│   ├── event_model.py
│   └── booking_model.py
├── templates/
│   ├── index.html
│   ├── events.html
│   ├── explore.html
│   ├── login.html
│   ├── userpanel.html
│   ├── admin.html
│   ├── reports.html
│   └── receipt.html
├── static/
│   ├── css/
│   ├── js/
│   └── assets/
└── docs/
    └── screenshots/
```

---

## Feature Highlights

### Event experience
- Discover featured Bristol events.
- Browse event listings and explore city experiences.
- Responsive UI with dark/light presentation.
- Cinematic homepage background delivered through YouTube instead of storing a massive video file in Git.

### Booking engine
- Create bookings against available event capacity.
- Handle waiting-list scenarios when events fill.
- Cancel bookings through the application workflow.
- Provide realtime booking-related updates through Socket.IO.

### User workspace
- Session-based authentication.
- Personal user dashboard.
- Booking history and account-focused views.
- Receipt generation for completed bookings.

### Admin command centre
- Administrative dashboard and protected routes.
- User and role management.
- Event management.
- Venue/category-oriented operational tooling.
- Reports covering bookings, attendance and revenue.

---

## Tech Stack

**Backend:** Python, Flask, Werkzeug  
**Database:** MySQL, PyMySQL  
**Realtime:** Flask-SocketIO, Simple-WebSocket  
**Documents:** ReportLab  
**Frontend:** HTML5, CSS3, JavaScript  
**Production server:** Gunicorn  
**Deployment:** Render  
**Version control:** Git + GitHub

---

## Local Development

### 1. Clone

```bash
git clone https://github.com/Edgar-50/Bristol-City-Events.git
cd Bristol-City-Events
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```env
FLASK_SECRET_KEY=replace-with-a-secure-random-value
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=bce_event_system
```

### 5. Start BCE

```bash
python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

---

## Production

The Render service uses:

```bash
pip install -r requirements.txt
```

and starts the application using:

```bash
gunicorn -w 1 --threads 100 --timeout 120 app:app
```

Sensitive values such as database credentials and Flask secrets are configured through environment variables rather than committed to the repository.

---

## Security Notes

- Password handling uses Werkzeug hashing.
- SQL operations use parameterized database queries.
- Authentication state is maintained through Flask sessions.
- Admin functionality is protected by role checks.
- Secrets and local runtime files are excluded through `.gitignore`.
- The former ~269 MB homepage MP4 is no longer stored in Git; the hero experience now uses an embeddable YouTube source.

---

## Roadmap

- [ ] Complete hosted MySQL production configuration
- [ ] Add automated tests for booking and authentication flows
- [ ] Add CI checks with GitHub Actions
- [ ] Add richer admin analytics visualisations
- [ ] Add email booking confirmations
- [ ] Add QR-based ticket validation
- [ ] Add event recommendation features
- [ ] Add Docker deployment option

---

## Author

**Edgar Charles Omondi**  
Computer Science / Software Engineering  
GitHub: [@Edgar-50](https://github.com/Edgar-50)

---

<div align="center">

### Built around Bristol. Engineered as a full-stack event operations platform.

</div>
