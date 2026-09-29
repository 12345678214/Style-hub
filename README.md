# Style Hub

Style Hub is a salon/grooming appointment website built with HTML, CSS, JavaScript, and Node.js.

## Run locally

Requirements: Node.js 18+.

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

The project is intentionally dependency-free for local development, so **`npm install` is not required**.

## Available pages

- `/` or `/index.html` — Home
- `/appointment.html` — Appointment booking
- `/contact.html` — Contact form

The navigation also contains Services, About Us, and Admin links. Those pages were not present in the supplied ZIP, so the server safely routes those links to the home page instead of returning a broken page.

## API endpoints

- `GET /api/health`
- `GET /api/all-services`
- `GET /api/premium`
- `GET /api/staff`
- `GET /api/available-staff`
- `POST /api/customers`
- `POST /api/appointments`
- `POST /api/messages`

Appointment and contact data are stored in memory while the server is running. Restarting the server clears demo data. A production version can replace these handlers with MySQL persistence without changing the frontend API contracts.

## Important

The original ZIP referenced `server.js` and `nodemon`, but did not contain `server.js`. This version includes a working Node.js server and keeps the existing frontend pages/design intact.
