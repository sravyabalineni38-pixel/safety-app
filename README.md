# Guardian — Personal Safety App

A full-stack personal safety app: SOS button, wearable (ESP32) integration,
live location sharing, AI risk-aware safe routing, unsafe-area reporting,
safety timers, fall detection, battery monitoring, a period tracker, an
AI safety assistant, and an admin dashboard.

```
safety-app/
  backend/    Node.js + Express API (JSON-file storage, no DB setup needed)
  frontend/   React + Vite + Tailwind app
```

## 1. Run the backend

```bash
cd backend
npm install
cp .env.example .env      # edit as needed
npm start                 # http://localhost:4000
```

`.env` options:
- `JWT_SECRET` — set this to a long random string.
- `ADMIN_SETUP_KEY` — used once to create your first admin account (see below).
- `TWILIO_*` — optional. Without these, SOS/fall alerts are **simulated**
  (logged to the console and stored in the event history) so the whole app
  works with zero paid services. Add Twilio credentials to send **real**
  SMS and voice calls to trusted contacts, police, and ambulance.
- `EMERGENCY_POLICE_NUMBER` / `EMERGENCY_AMBULANCE_NUMBER` / `EMERGENCY_WOMEN_HELPLINE`
  — defaults are India's 100 / 108 / 1091. Change for your country.

## 2. Run the frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so run the
backend first.

## 3. Create your accounts

1. Go to `http://localhost:5173/register` to create a normal user account.
2. Go to `http://localhost:5173/admin/login`, click **"First time setup?"**,
   and create an admin account using the `ADMIN_SETUP_KEY` from your `.env`.

## 4. Connecting a real wearable (ESP32)

The `/wearable` page in the app documents the wiring. In short:
- GPS module (e.g. NEO-6M) for location.
- MPU6050 accelerometer/gyroscope for fall detection.
- A push button wired to a GPIO pin for the physical SOS button.
- On SOS press → the board POSTs to `POST /api/sos/trigger` with `{ lat, lng }`.
- On a detected fall → the board POSTs to `POST /api/fall-detection` with `{ confidence, lat, lng }`.
- Both endpoints require the paired user's JWT in the `Authorization: Bearer <token>` header —
  provision this token onto the device during pairing (see `/api/wearable/pair`).

## Notes on real emergency calling

Actually placing automated calls/SMS to trusted contacts, police, and
hospitals requires a telephony provider (this project ships wired up for
**Twilio**, see `backend/notify.js`). Real emergency-service integrations
and phone-carrier rules vary by country — check local regulations before
deploying this for real-world use. Until Twilio is configured, every
SOS/fall alert is fully simulated end-to-end (visible in Emergency History)
so you can build and demo the whole product for free.

## Feature → file map

| Feature | Backend route | Frontend page |
|---|---|---|
| Login / Registration | `routes/auth.js` | `pages/Login.jsx`, `pages/Register.jsx` |
| SOS button (app + wearable) | `routes/sos.js` | `components/SOSButton.jsx` |
| Trusted contacts | `routes/contacts.js` | `pages/Contacts.jsx` |
| Live location | `routes/location.js` | used across SOS/Dashboard |
| Smart safety navigation / AI risk | `routes/aiRisk.js` | `pages/SafeRoute.jsx` |
| Wearable integration | `routes/wearable.js` | `pages/Wearable.jsx` |
| Fall detection | `routes/fallDetection.js` | `pages/FallDetection.jsx` |
| Safety timer | `routes/safetyTimer.js` | `pages/SafetyTimer.jsx` |
| Unsafe area reporting | `routes/unsafeAreas.js` | `pages/UnsafeAreas.jsx` |
| Battery monitoring | `routes/battery.js` | `pages/Battery.jsx` |
| Period tracker | `routes/periodTracker.js` | `pages/PeriodTracker.jsx` |
| AI assistant | `routes/aiAssistant.js` | `pages/AIAssistant.jsx` |
| Emergency history | `routes/sos.js`, `routes/fallDetection.js` | `pages/EmergencyHistory.jsx` |
| Admin dashboard | `routes/admin.js` | `pages/AdminDashboard.jsx`, `pages/AdminLogin.jsx` |

## Swapping in a production database

Everything reads/writes through `backend/db.js`. It currently persists to
a JSON file (`backend/data/db.json`) so there's nothing to install. To move
to Postgres/Mongo, reimplement the functions in `db.js` with the same
signatures (`collection(name).find/findOne/insert/update/remove`) and no
route file needs to change.
