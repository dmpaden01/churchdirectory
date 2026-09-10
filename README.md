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

Create `backend/.env` (not committed) with:

```
PORT=5000
MONGO_URI=mongodb://<user>:<password>@<host>:27017?retryWrites=true&w=majority
JWT_SECRET=<a long random string>
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

## Notes

- `.env` files are intentionally not committed; see the backend setup above for the variables needed.
- `backend/scripts/migratePhotosToBlob.js` was a one-time migration from an earlier filesystem-based photo storage design; kept for reference.
