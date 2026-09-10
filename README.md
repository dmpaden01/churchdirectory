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
