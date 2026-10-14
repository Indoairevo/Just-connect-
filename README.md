# Nexora Studio

Nexora is a fully local responsive digital growth studio website with a zero-dependency Node.js lead-capture API, SQLite database, and protected admin dashboard. The UI, styles, fonts fallback, and API are served from this project without CDN or third-party runtime assets.

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Open <http://localhost:8080>. The Chrome launch configuration in `.vscode/launch.json` expects the same port.

Create the first admin account when starting the server:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='use-a-12-character-password' npm start
```

Then open <http://localhost:8080/login.html>. The admin dashboard is at <http://localhost:8080/admin.html>.

## API

- `GET /api/health` — service health check
- `POST /api/leads` — validates and stores a lead in the SQLite database
- `GET /api/leads` — returns captured leads for authenticated admins
- `PATCH /api/leads/:id` — updates proposal, project, payment, and portal settings for authenticated admins
- `POST /api/leads/:id/messages` — records a prepared email or SMS message for authenticated admins
- `GET /api/client-project/:token` — returns approved project details for a valid, unexpired client token
- `POST /api/client-project/:token/response` — records a customer acceptance, change request, or decline
- `POST /api/auth/login` / `POST /api/auth/logout` — session authentication
- `GET /api/auth/me` — current authenticated user

Sign-in attempts are rate limited per client address (10 attempts per 15 minutes), and public lead submissions are limited per address (20 per hour) with a honeypot field.
The browser UI supports reduced-motion preferences and falls back gracefully when
`IntersectionObserver` is unavailable.

SQLite data is stored in `data/nexora.sqlite` and intentionally ignored by git. Sessions are stored as hashed tokens and passwords use Node's `scrypt`. Client portal tokens expire after 30 days and can be revoked from the admin workflow. For production, set `NODE_ENV=production` behind HTTPS, configure backups, and connect a managed email/SMS provider for automatic delivery.
