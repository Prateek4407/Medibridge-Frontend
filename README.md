# MediBridge (React)

React + Vite version of the MediBridge project. Layout, CSS and behaviour are the same as the original
HTML/CSS/JS version, with a new **medical documents** feature.

## Run (frontend + backend)
1. Start the backend first (see the MediBridge_Backend project): `npm run seed` once, then `npm run dev` -> http://localhost:5000/api
2. Frontend:

       npm install
       cp .env.example .env     # VITE_API_URL=http://localhost:5000/api
       npm run dev              # http://localhost:5173
       npm run build            # production build in /dist

The backend allows requests from http://localhost:5173 (CORS `CLIENT_URL` in the backend `.env`).

## Demo accounts (password demo1234) - created by `npm run seed` on the backend
- Patient: patient@demo.test
- Doctor:  doctor@demo.test

## What is connected to the backend
| Screen | API |
|---|---|
| Login / Register / logout | `/auth/login`, `/auth/register`, `/auth/me` (token kept in localStorage `mb_token`) |
| Hospital Finder, hospital pickers, "best match" | `/hospitals`, `/hospitals/best-match` |
| Emergency Request | `POST /cases` (works without login) |
| Live Tracking (polls every 1.5 s, public share link `#/tracking?case=CB-1234`) | `/cases/:caseId/track`, `/advance`, `/restart`, `POST /cases/demo` |
| Patient dashboard: active case, care logs | `/cases/active`, `/cases` |
| Appointments (patient and doctor scheduling) | `/slots`, `/slots/:id/book`, `/cancel` |
| Payments | `/invoices`, `/invoices/:id/pay`, `/receipt` |
| Documents (patient upload, doctor read-only view) | `/documents`, `/documents/summary`, `/documents/patients`, `/documents/:id/file` |
| Doctor: acknowledge readiness | `POST /cases/:caseId/acknowledge` |

All API calls live in `src/lib/api.js`. Files up to 10 MB (PDF / JPG / PNG / Word / text) are stored on the backend
and only served to the owner or to a logged-in doctor.

## New: Ambulance Response Delay Prediction (ML feature)
Page: `#/delay` (sidebar -> "Response Delay Prediction", also a shortcut on the Patient dashboard). Works without login.
- Form -> **Predict Response Delay** button -> POST to the backend -> shows the delay in **minutes**
  (plus an optional range and model version). Has loading, validation and error states and an
  "estimate, not exact arrival time" note.
- **Form fields:** edit only `src/lib/predictionConfig.js` (keys, labels, options, min/max).
- **API call:** `src/lib/predictionApi.js`. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`
  (e.g. http://localhost:8000). Default endpoint: `POST /predict/response-delay`.
  Leave `VITE_API_BASE_URL` empty for **demo mode** (built-in formula, clearly labelled on screen).
- Expected response: `{ "predicted_delay_minutes": 7.4, "range": {"low": 5.8, "high": 9.1}, "model_version": "v1" }`
  (`range` and `model_version` optional). The backend must allow CORS from the frontend URL.

## Structure
- src/App.jsx - hash router (same #/routes as before)
- src/pages/ - Home, Login, Register, Finder, Request, Tracking, Patient, Doctor, DelayPredict (new)
- src/components/ - AppShell (header/sidebar/modal/toast), Documents (new), ui
- src/lib/ - api (all backend calls), hooks (useFetch), store (session / tracked case in localStorage), data (constants), documents (file helpers),
  predictionConfig + predictionApi (new, delay prediction)
- src/index.css - original style.css + a small block for the documents UI


## New in this version
* **Ambulance management** (doctor console > Ambulances): add vehicles, link a driver login, set available / offline / maintenance.
* **Driver page** (register as "Ambulance driver"): shows the linked ambulance and shares real GPS while the page is open.
* **Live Tracking** now uses a server stream, shows the assigned ambulance, and labels its position **Live GPS** or **Simulated**.
* **Hospital Finder** and **Response Delay Prediction** show / pre-fill the number of free ambulances.
* **My Documents** (patient): consent switch plus "who opened my records" and consent history. Doctors see their own activity.
* **Register**: doctors and ambulance drivers can sign up; they see "waiting for administrator approval" and can log in once approved.
* **Admin page** (log in with the Admin role): approve, reject or revoke doctor and driver accounts.
