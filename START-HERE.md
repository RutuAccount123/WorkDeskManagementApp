# Work Desk

| Folder | What |
|---|---|
| `workdesk-frontend` | React app. Runs alone with sample data (`VITE_USE_MOCK=true`) or with the backend (`false`). |
| `workdesk-backend` | Java Spring Boot server: controller → service → repository (JPA) → entity, PostgreSQL. See its README. |

**Use them together**
1. pgAdmin: create an empty database `workdesk`. (Your user / password go in `workdesk-backend/src/main/resources/application-dev.yml`.)
2. Backend: VS Code → Spring Boot Dashboard → ▶ `workdesk-backend`. Wait for `Started WorkDeskApplication` (port 8082).
3. Frontend: in `workdesk-frontend/.env` set `VITE_USE_MOCK=false`, then `npm install` and `npm run dev`.
4. Open http://localhost:5173 and sign in with `admin@company.com` / `Admin@123`.
