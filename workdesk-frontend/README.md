# Work Desk: Employee Work Management (Frontend)

React frontend for the Employee Work Management System. It runs **on its own with built-in sample data**, so no backend is needed to try it. When the Spring Boot backend is ready, change one setting and it talks to the real API.

---

## 1. Run it (first time)

You need **Node.js 18 or newer** (`node -v` to check) and **VS Code**.

1. Extract `workdesk-frontend.zip`.
2. VS Code → **File → Open Folder** → select the `workdesk-frontend` folder (the one with `package.json` inside).
3. Open the terminal (`Ctrl + ~`) and run:
   ```
   npm install
   ```
   ```
   npm run dev
   ```
4. Open **http://localhost:5173**.

Next time you only need `npm run dev`. Stop it with `Ctrl + C`.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@company.com | Admin@123 |
| Employee | rahul@company.com, priya@company.com, sneha@company.com, amit@company.com | Employee@123 |

Changes you make are saved in your browser. **My account → Reset demo data** restores the original sample data.

### Common problems

| Message | Fix |
|---|---|
| `Could not read package.json` | The terminal is in the wrong folder. Open the folder that contains `package.json`. |
| `npm.ps1 cannot be loaded` | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then press `Y`. |
| `Port 5173 is in use` | An older `npm run dev` is still running. Stop it with `Ctrl + C`. |
| Old screens still showing | Press `Ctrl + F5` in the browser. |

---

## 2. Project structure

Feature-based layout, the same pattern used in most company React projects: each business area keeps its screens and parts together, and everything shared lives in one place.

```
workdesk-frontend/
├── index.html
├── vite.config.js            Build tool config, "@/" import alias, /api proxy
├── jsconfig.json             Lets VS Code understand "@/" imports
├── .env                      VITE_USE_MOCK (sample data or real backend), VITE_API_URL
├── .prettierrc  .editorconfig  .vscode/   Code formatting & editor settings
└── src/
    ├── main.jsx              Starts the app
    ├── app/
    │   ├── App.jsx           Providers (router, login)
    │   └── AppRoutes.jsx     Every page and who can open it
    ├── config/
    │   ├── env.js            Reads .env settings
    │   └── navigation.js     Side menu for admin / employee, page titles
    ├── services/             ★ The ONLY place that talks to the backend
    │   ├── http.js           Request helper: login token, errors, mock switch
    │   ├── authService.js    employeeService.js   taskService.js
    │   ├── recurringService.js   holidayService.js
    │   ├── notificationService.js   reportService.js
    │   └── index.js
    ├── features/             One folder per business area
    │   ├── auth/             Login page, signed-in user
    │   ├── dashboard/        Admin dashboard, everyone's work today
    │   ├── my-work/          Employee home, add own work, daily & weekly list
    │   ├── tasks/            Task list, full task page, assign form
    │   ├── calendar/         Day / Week / Month / Year views
    │   ├── performance/      Monthly score card
    │   ├── employees/        Employee list and profile page
    │   ├── recurring/        Admin: daily & weekly tasks
    │   ├── holidays/         Office holiday calendar
    │   ├── workflows/        FMS: sheet-style editor, FMS sheet + tracker, today's progress
    │   ├── reports/          Reports and Excel download
    │   ├── notifications/    Bell panel, desktop pop-ups
    │   └── account/          Change password
    ├── components/
    │   ├── layout/           AppLayout, Sidebar, Topbar (page frame)
    │   └── ui/               Reusable parts: Icon, Modal, StatusChip, StatusSteps
    ├── utils/                Date/label formatting, person colours
    ├── styles/
    │   ├── tokens.css        ★ All colours, fonts, sizes. Change the theme here.
    │   ├── base.css          Page defaults
    │   ├── layout.css        Sidebar, top bar, mobile bar
    │   ├── components.css    Buttons, forms, cards, tables, chips, drawer
    │   ├── features.css      Screen-specific styles
    │   ├── theme.css         ★ Pastel cards, welcome banner, menu colours (the look)
    │   └── index.css         Loads the files above in order
    ├── mock/                 Sample data + fake backend (used while VITE_USE_MOCK=true)
        ├── data.js           ★ Edit sample employees, tasks, holidays here
        └── mockServer.js     Same rules and responses as the real API
    └── test/                 Unit and integration tests (npm test)
```

### How a screen gets data

```
Page (features/…)  →  service (services/taskService.js)  →  http.js  →  mock server  OR  Spring Boot API
```

Screens never write API URLs themselves. To connect a different backend, only `src/services/` changes.

### Conventions

- Import with the alias: `import { taskService } from '@/services/index.js'`, not long `../../` paths.
- One component per file, file name = component name (`TaskDetailPage.jsx`).
- Pages end in `Page.jsx` and live in their feature folder.
- Colours and sizes always come from `styles/tokens.css` variables (`var(--primary)`), never typed directly.

---

## 3. Theme

Set in `src/styles/tokens.css`:

| Role | Colour | Used for |
|---|---|---|
| Dark | Solid deep violet `#2E1065` | Side menu, login panel, phone bottom bar |
| Bold | Solid violet `#6D28D9` / `#7C3AED` | Welcome banner, main buttons |
| Faint | Pastel lavender, peach, mint, sky, rose | Number cards, banners, employee card headers |
| Background | Soft lavender-white `#F6F4FC` with white cards | Page areas |
| Text | Deep plum `#1F1636` (not black) | All text |

All colours are plain and solid (no gradients). They are defined in `tokens.css`; card and banner styles are in `theme.css`.

Status colours are the same everywhere: **To do** orange, **In progress** blue, **Waiting for review** violet, **Done** green, **Overdue** red, **Holiday** coral.

To use your company brand colours, change `--primary`, `--hero-bg`, `--button-bg` and `--nav-solid` in `tokens.css`.

---

## 4. What's in the app

**Admin:** dashboard with everyone's work today, tasks, employees (with full profile and performance), daily & weekly tasks, holidays, reports with Excel download.

**Employee:** My work (today's reminder, Day/Week/Month/Year calendar, add own one-time / daily / weekly work, monthly performance), My tasks, My summary, Holidays.

**Assigning & reviewing (anyone, not only admin):**
- **Anyone can assign a task to anyone** with **Assign a task** (on My work and Tasks).
- The person assigning picks **who reviews it**. By default it's themselves, but it can be anyone except the person doing the work.
- The assignee **submits** the work to the reviewer. Only the **reviewer** (or an admin) can **Approve** or **Send back** with a note.
- The person who assigned the task can edit or cancel it.
- Own work: choose a reviewer if someone should check it, or "No review needed" to close it yourself.
- **Tasks** page tabs: **Assigned to me / I assigned / To review**. My work shows a **Waiting for my review** box.
- Notifications go to the right people: the assignee when assigned, the reviewer when chosen and when work is submitted, and the assignee and assigner when it's approved or sent back.

**Workflows (FMS), laid out like the FMS Excel sheet:**
- Menu → **Workflows (FMS)** → **New FMS** opens a full page that looks like the FMS sheet. Each step is a **column**, and the **rows are What · Who · How · When**:
  - **Column 0 (Trigger):** what starts the work, the **entry-form questions** (filled every time the work starts), and **When**: every working day, once a week, or **only when started**, plus the start and end time.
  - **Step columns:** What = the work, Who = the person, **How = numbered steps (1, 2, 3…)** plus an optional note, When = "within X hrs" (the page shows the planned finish time of each step).
  - ← → moves a step, × removes it, **+ Add step** adds a column.
- **Linked task:** an FMS can be created for an **existing task**. Pick it in **Linked task**, or open any task and press **+ Create FMS for this task** (the task is already selected and the name filled in). Tick **Start this FMS now** to start it right away.
- The task page shows **FMS for this task**: the linked FMS (Open sheet / Start new) and the progress of every run started for it. When a run finishes, the task gets a note and its people are notified.
- **FMS sheet page** (click an FMS name): the What/Who/How/When grid, plus a **Tracker** like the Excel sheet. It has one row per run: timestamp, the form answers, and for each step **Planned · Actual · Status · Time delay** (red = late, green = on time). Pick the dates with From / To. Click a step to open its task.
- **Start new:** fill the form and step 1 starts at once. Scheduled runs assign step 1 at the start time, marked **Fill form to start**.
- When a step is done, **the next step is assigned immediately**, due *finish time + step hours* (kept within the day's end time). On a step's task page, **How to do it** lists the numbered steps; every one must be ticked before **Mark done**.
- Steps need no review. Workflows don't run on Sundays or office holidays. **Pause** stops future runs; edits apply from the next run.

**Task page:** clicking any task opens a full page (not a side panel). It shows the status, actions, notes, history and details; for an FMS step it also shows the form (to fill, or the answers), How, the checklist, and the whole workflow's progress. The browser Back button returns to the list.

**Rules:**
- Status words are the same on every screen, export and history line (set once in `STATUS_LABEL`, `src/utils/format.js`).
- Task flow: To do → In progress → Waiting for review → Done (the reviewer can send back with a note).
- Daily tasks run Monday to Saturday; weekly tasks can be set for Monday to Saturday. Nothing is created on Sundays or office holidays.
- Performance score = 60% work completed + 40% completed on time.

---

## 5. Connect the real backend

The ready backend is the **workdesk-backend** folder (Java Spring Boot + Spring Data JPA + PostgreSQL). Start it as its README says, then:

In `.env` set:
```
VITE_USE_MOCK=false
```
Restart `npm run dev`. API calls go to `http://localhost:8082` (see `vite.config.js`). If the backend is on another address, also set `VITE_API_URL=https://api.yourcompany.com`.

The backend needs these endpoints. `src/mock/mockServer.js` has the exact logic for each:

| Area | Endpoints |
|---|---|
| Login | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Employees | `GET/POST /api/employees`, `GET/PUT /api/employees/{id}`, `PATCH …/active`, `POST …/reset-password` |
| People | `GET /api/people`: active people (id, name, department) for any signed-in user, used in "Assign to" and "Reviewed by" |
| Tasks | `GET /api/tasks?scope=assigned\|created\|review\|all&status=&assigneeId=&priority=&overdue=&q=&workFrom=&workTo=`, `POST` (anyone; body has `assigneeId`, `reviewerId`), `GET/PUT/DELETE /api/tasks/{id}`, `POST …/status`, `POST …/comments`, `GET …/activity` |
| Daily & weekly | `GET/POST /api/recurring`, `PUT/DELETE /api/recurring/{id}`, `PATCH …/active`, `POST …/generate-now` |
| Holidays | `GET /api/holidays?year=` or `?from=&to=`, `POST`, `PUT/DELETE /api/holidays/{id}` |
| Workflows (FMS) | `GET/POST /api/workflows` (with `formFields[]` and steps with `how`, `checklist[]`), `PUT/DELETE /api/workflows/{id}`, `PATCH …/active`, `POST …/start-now` (body `formData`), `POST /api/workflows/runs/{runId}/form`, `POST /api/tasks/{id}/checklist` (`index`, `done`), `GET /api/workflows/runs?date=` or `?taskId=`, `GET /api/workflows/runs/{runId}`, `GET /api/workflows?taskId=` (FMS linked to a task), `GET /api/workflows/{id}/runs?from=&to=` (tracker rows with `planned`, `actual`, `delayMinutes` per step). Body fields: `frequency` DAILY / WEEKLY / ON_DEMAND, `sourceTaskId`, `startNow`. Scheduler starts step 1 of each run; completing a step's task creates the next step's task. |
| Notifications | `GET /api/notifications`, `GET …/unread-count`, `POST …/{id}/read`, `POST …/read-all` |
| Reports | `GET /api/reports/dashboard`, `/team`, `/performance?employeeId=&month=`, `/yearly?employeeId=&year=`, `/employees?from=&to=`, `/employees.csv`, `/daily?from=&to=&employeeId=` |

---

## 6. Tests

```
npm test            run all tests once
npm run test:watch  re-run tests while you edit
npm run coverage    tests + a coverage report (opens in coverage/index.html)
```

Tests live in `src/test/` and use **Vitest** + **React Testing Library**. They run on the built-in sample data, so no backend is needed.

| Folder | What it checks |
|---|---|
| `src/test/unit/` | Date and label helpers, the request helper (`http.js`) in sample-data mode **and** against a real backend (fetch is faked), who-can-do-what button rules, and the small shared parts (status chip, status steps, form, pop-up). |
| `src/test/integration/` | Every API area through the real services: sign in, people, tasks (assign → submit → send back → approve), own work, comments, notifications, daily & weekly tasks, holidays, FMS (start, checklist, next step, form, linked task), reports. Plus the full app in a test browser: admin and employee menus, page titles, permissions, task page, FMS sheet, the assign form. |

**Same format everywhere.** One test opens every menu page as admin and as employee and checks that the menu label, the top-bar title and the page heading say the same thing, and that each page has one heading row. If you add a page, add it to `src/config/navigation.js` and the test covers it.

---

## 7. Build for hosting

```
npm run build
```
Upload the `dist/` folder to Netlify, Vercel or any web host. `public/_redirects` and `vercel.json` are already set so page links work after a refresh.
