# Church Directory App

A full-stack church directory admin tool: manage families and individuals, upload family/individual photos, import legacy directory data from PDF exports, and control access with login/role-based accounts.

## Stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Database:** MongoDB (via Mongoose)

## Getting started

### 1. Backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` (not committed) and fill in real values:

```
PORT=5000
MONGO_URI=mongodb://<user>:<password>@<host>:27017?retryWrites=true&w=majority
JWT_SECRET=<a long random string>

# Google Workspace SMTP relay (SMTP AUTH + TLS) - see backend/.env.example for details
SMTP_HOST=smtp-relay.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-relay-username>
SMTP_PASS=<smtp-relay-password>
EMAIL_FROM="Church Directory <noreply@example.com>"

BACKEND_PUBLIC_URL=http://localhost:5000
FRONTEND_PUBLIC_URL=http://localhost:5173
```

Bootstrap the first admin account (the in-app "create user" flow needs an admin to already exist):

```bash
node scripts/createUser.js <username> <password> admin
```

Start the backend:

```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:5000`.

## Production deployment (Docker)

Three containers, built from `docker-compose.yml` at the repo root:

- `churchdirectory-frontend` - nginx serving the built React app, proxying `/api/*` internally to the backend so the browser only ever talks to one origin
- `churchdirectory-backend` - the Express API
- `churchdirectory-db` - official `mongo` image, with a named volume (`churchdirectory-db-data`) so data survives container restarts/recreation

```bash
cp .env.example .env    # fill in real values - see comments in the file
docker compose up -d --build
```

The app is then served on `http://<host>:${HTTP_PORT:-80}`.

Notes:
- This has been written but **not yet run** - it's meant to be tested on a Linux Docker host.
- `backend/.env` (local dev) and the root `.env` (Docker Compose) are separate files with an overlapping but not identical set of variables - see the comments in `.env.example` for what's different (notably `MONGO_ROOT_USERNAME`/`MONGO_ROOT_PASSWORD` for bootstrapping the db container, and `COOKIE_SECURE` for HTTP-only deployments without TLS yet).
- Auth cookies default to `Secure` (HTTPS-only) in production. If you don't have TLS in front of this yet, set `COOKIE_SECURE=false` in `.env` or login will silently never persist a session in the browser.
- The backend and db containers aren't published to the host by default (only reachable from the frontend container over the internal `churchdirectory-net` network) - only the frontend's port is exposed.

### Behind a reverse proxy (e.g. Nginx Proxy Manager)

`churchdirectory-frontend` joins a second, external Docker network (`npm-network` by default, set via `NPM_NETWORK_NAME` in `.env`) so a reverse proxy handling TLS can reach it directly by container name instead of going back out through the host's published port.

1. Make sure that network already exists - it's whatever Docker network your reverse proxy's own stack uses (`docker network ls` to check, or look at its compose file). Set `NPM_NETWORK_NAME` in `.env` to match.
2. In the proxy (e.g. NPM's UI), add a proxy host pointing at `churchdirectory-frontend` on port `80`, with SSL/Let's Encrypt handled there.
3. Leave `COOKIE_SECURE=true` - the browser's connection to the proxy is real HTTPS even though the proxy talks to this app over plain HTTP internally, and that's what the cookie's `Secure` flag actually depends on.
4. Set `BACKEND_PUBLIC_URL` and `FRONTEND_PUBLIC_URL` to the real public HTTPS domain configured in the proxy (both the same - see the "Public URLs" note above).
5. The `HTTP_PORT` host publish in `docker-compose.yml` can be left in place (harmless fallback for direct access) or removed if you want the app reachable only through the proxy.

## Features

- Family/individual CRUD with dynamic spouse/child entries
- Drag-and-drop photo upload for families and individuals, stored directly in MongoDB as binary data (served via `/api/families/:id/photo` and `/api/families/:id/individuals/:index/photo`) so all family data lives in one place
- Search families by last name
- Import families from a legacy directory PDF export, including best-effort photo extraction, with a per-family review step before anything is saved
- Username/password login with `admin` and `user` roles; admins manage the directory and other user accounts; users can change their own password
- Self-service account registration: a visitor requests an account with their email/first/last name, confirms their email via a link, then waits for an admin to approve or deny the request from the Users page. Approval emails a "Set Password" link; denial emails a notice to contact the Church Office.

## Notes

- `.env` files are intentionally not committed; copy `backend/.env.example` and fill in real values. It's the reference template for anyone setting up a new environment.
- `backend/scripts/migratePhotosToBlob.js` was a one-time migration from an earlier filesystem-based photo storage design; kept for reference.
- Registration/approval emails require a working SMTP config (see `backend/.env.example`). If sending fails, the affected request is left in its prior state (not silently marked verified/approved/denied) so it can be retried once email is working.
