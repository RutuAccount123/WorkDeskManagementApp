# Work Desk

| Folder | What |
|---|---|
| `workdesk-frontend` | React app. Runs alone with sample data (`VITE_USE_MOCK=true`) or with the backend (`false`). |
| `workdesk-backend` | Java Spring Boot server: controller → service → repository (JPA) → entity, PostgreSQL. See its README. |
| `.github/workflows/ci-cd.yml` | CI/CD: on every push to `main`, tests run first; only if all pass does the code go to production. |

---

## 1. Run on your computer

**Option A: frontend only, with sample data (no Java, no database)**
1. `workdesk-frontend/.env` → `VITE_USE_MOCK=true`
2. In a terminal: `cd workdesk-frontend`, then `npm install` (first time only), then `npm run dev`
3. Open http://localhost:5173 → `admin@company.com` / `Admin@123`

**Option B: frontend + real backend + local PostgreSQL**
1. pgAdmin: create an empty database `workdesk`. (User / password are in `workdesk-backend/src/main/resources/application-dev.yml`: `postgres` / `root`.)
2. Backend: VS Code → Run and Debug → **WorkDesk Backend (dev)** ▶ (or Spring Boot Dashboard → ▶ `workdesk-backend`).
   Wait for `Started WorkDeskApplication` (port 8082). **Keep it running.**
3. `workdesk-frontend/.env` → `VITE_USE_MOCK=false`
4. Second terminal: `cd workdesk-frontend`, then `npm run dev`
5. Open http://localhost:5173 → `admin@company.com` / `Admin@123`

**If it doesn't work locally**

| What you see | Cause and fix |
|---|---|
| Login page: "Cannot reach the server" | `VITE_USE_MOCK=false` but the backend is not running. Start it (step B2) or use Option A. |
| Backend: `Migration checksum mismatch` | A migration file (`V1004…`, `V1005…`) was changed after it already ran on your local database. Local only: delete and recreate the `workdesk` database in pgAdmin, then start again. Never edit a `V…sql` file that already ran on the server; add a new `V1006__….sql` instead. |
| Backend: `Connection refused … 5432` | PostgreSQL is not running, or the password in `application-dev.yml` is wrong. |
| Backend: `Port 8082 was already in use` | The backend is already running in another window. Stop it first. |
| Frontend shows old screens | Press `Ctrl + F5` in the browser. |

---

## 2. Online (production)

| Part | Where |
|---|---|
| Frontend | Vercel (`workdesk-frontend`) |
| Backend | Render (`workdesk-backend`, Docker, `SPRING_PROFILES_ACTIVE=prod`) |
| Database | Neon PostgreSQL |

`application.yml` says `default: dev`. That is used **only when no profile is set** (your computer).
Render sets `SPRING_PROFILES_ACTIVE=prod`, so the server never uses the dev settings.

---

## 3. CI/CD: push to `main` → tests → production

```
git push (main)
  → GitHub Actions: Frontend tests + build, Backend tests
  → all ✅ → Vercel deploys the frontend, Render deploys the backend
  → any ❌ → nothing is deployed; the website keeps running the previous version
```

One-time setup (already done if the site is live with CI/CD):
1. **Vercel** → project → Settings → Git → **Deploy Hooks**: name `github-ci`, branch `main` → copy the URL.
2. **GitHub** → repo → Settings → Secrets and variables → Actions → New secret `VERCEL_DEPLOY_HOOK` = that URL.
3. **Render** → service → Settings → Deploy → **Auto-Deploy: After CI Checks Pass**.
4. `workdesk-frontend/vercel.json` has `"deploymentEnabled": { "main": false }`, so Vercel waits for the tests.

Every day after that:
```
git add .
git commit -m "what you changed"
git push
```
Then watch GitHub → **Actions**.

Notes:
- The workflow file must be in `.github/workflows/` (not inside `.github/modernize/`, which git ignores).
- Database changes go in a **new** file `workdesk-backend/src/main/resources/db/migration/V1006__name.sql`. It runs on Neon automatically when Render deploys.
