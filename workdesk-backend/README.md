# Work Desk: Backend (Java Spring Boot + Spring Data JPA + PostgreSQL)

The server for the Work Desk frontend. Every API returns the **same JSON** the frontend already uses,
so the frontend works with `VITE_USE_MOCK=false` and nothing else changed.

- **Java 25 LTS, Spring Boot 3.5**
- **Spring Data JPA (Hibernate)**: one entity per table, repositories with JPA methods
- **Spring Security**: JWT sign-in, BCrypt passwords, role checks
- **PostgreSQL**: tables are created by **Flyway** (`db/migration`); all business rules are in **Java services**

---

## 1. How the code is organised (4 layers)

Every API follows the same path:

```
HTTP request
   │
   ▼
controller/   ── reads the request (DTO), calls ONE service method, returns a DTO. No rules here.
   │
   ▼
service/      ── ALL business rules: who can do what, task flow, FMS steps, reports. @Transactional.
   │              uses mapper/ to turn entities into response DTOs
   ▼
repository/   ── Spring Data JPA interfaces: findBy…, existsBy…, @Query. No SQL strings in services.
   │
   ▼
entity/       ── one class per database table (@Entity), with relations (@ManyToOne)
   │
   ▼
PostgreSQL
```

Errors: a service throws an exception from `exception/` (for example `NotFoundException.of("Task")`), and
`GlobalExceptionHandler` turns it into `{"status": 404, "message": "Task not found"}`.

### Packages

```
com.decentdecor.workdesk
├── WorkDeskApplication.java        starts the app
├── controller/                     8 controllers, one per area (thin: request in, DTO out)
│   ├── AuthController              /api/auth/**
│   ├── EmployeeController          /api/people, /api/employees/**
│   ├── TaskController              /api/tasks/**
│   ├── RecurringTaskController     /api/recurring/**
│   ├── HolidayController           /api/holidays/**
│   ├── WorkflowController          /api/workflows/**  (FMS, runs, tracker)
│   ├── NotificationController      /api/notifications/**
│   └── ReportController            /api/reports/**   (also the Excel/CSV download)
├── service/                        business rules
│   ├── AuthService, EmployeeService, TaskService, RecurringTaskService, HolidayService,
│   │   WorkflowService, NotificationService, ReportService, SchedulerService
│   ├── WorkflowEngine              how an FMS run moves step by step
│   ├── RecurringGenerator          makes daily / weekly copies for the next 7 days
│   └── support/                    small shared helpers used by the services
│       ├── TaskRules               who may move a task from one status to another
│       ├── People                  "me", active assignee, choosing a reviewer
│       ├── WorkflowAccess          who can see / change an FMS
│       ├── FormValidator           checks a filled FMS form
│       ├── PerformanceCalculator   score = 60% done + 40% on time
│       ├── WorkingDays             not Sunday, not a holiday
│       ├── TodayWork, ActivityLogger
├── repository/                     Spring Data JPA (one per entity)
│   └── TaskSpecifications          the task list filters (scope, status, search…)
├── entity/                         one class per table
│   ├── Employee, Task, TaskActivity, Notification, Holiday,
│   │   RecurringTemplate, Workflow, WorkflowRun, DigestLog
│   ├── enums/                      Role, TaskStatus, Priority, RepeatFrequency, WeekDay, …
│   └── json/                       values stored in jsonb columns: ChecklistItem, FormField, WorkflowStep
├── dto/                            request and response objects, one folder per area
│   ├── auth, common, employee, task, recurring, holiday, notification, workflow, report
├── mapper/                         entity → response DTO (EmployeeMapper, TaskMapper, …)
├── exception/                      ApiException + BadRequest / NotFound / Forbidden / Conflict / … + GlobalExceptionHandler
├── security/                       JWT, filter, password rules, sign-in limit, SecurityConfig
├── scheduler/SchedulerJobs         timer: every 5 min → SchedulerService
├── config/                         settings (AppProperties), first admin, clock
└── util/                           OfficeTime (dates in India time), Enums, Texts, CsvUtil
```

### Tables ↔ entities

| Table | Entity | Relations |
|---|---|---|
| `employee` | `Employee` | — |
| `task` | `Task` | assignee, createdBy, reviewer → Employee; recurringTemplate; linkedWorkflow; workflowRun |
| `task_activity` | `TaskActivity` | task → Task, actor → Employee |
| `notification` | `Notification` | recipient → Employee, task → Task |
| `holiday` | `Holiday` | — |
| `recurring_template` | `RecurringTemplate` | assignee, createdBy → Employee; workflow → Workflow |
| `workflow` | `Workflow` | createdBy → Employee; sourceTask → Task; steps / formFields as JSON |
| `workflow_run` | `WorkflowRun` | workflow, createdBy, formFilledBy, sourceTask; steps / formFields / formData as JSON |
| `digest_log` | `DigestLog` | composite key (employee, day) |

All relations are `LAZY`. Data is read inside the service transaction and turned into DTOs there
(`spring.jpa.open-in-view: false`), so nothing is loaded by accident while writing the response.

---

## 2. How to add or change something

**A new field on an existing table** (example: `location` on a task)
1. Add a migration `src/main/resources/db/migration/V1002__task_location.sql`:
   `alter table task add column location varchar(120);`
   (never edit an old `V…` file that already ran on a server)
2. `entity/Task.java`: add the field with `@Column(name = "location")` and its getter / setter.
3. `dto/task/TaskRequest.java` and `TaskResponse.java`: add `location`.
4. `service/TaskService.java`: copy it in `create` / `update`.
5. `mapper/TaskMapper.java`: put it in the response.

**A new API** (example: GET /api/tasks/{id}/summary)
1. Response DTO in `dto/task/`.
2. A method in `TaskService` (rules + `@Transactional(readOnly = true)`).
3. If you need new data: a method in `TaskRepository` (e.g. `List<Task> findByPriority(Priority p)`).
4. One method in `TaskController` that calls the service and returns `ResponseEntity.ok(...)`.
5. Is it admin only? Add it to `SecurityConfig` **and** call `people.requireAdmin(user)` in the service.

**Change a rule** → it is in `service/`. Task status rules are in `service/support/TaskRules.java`.

**Show an error to the person** → `throw new BadRequestException("Clear message")` (or NotFound / Forbidden / Conflict).

---

## 3. Security

| What | How |
|---|---|
| Passwords | Only BCrypt hashes (cost 12). Never returned by any API. At least 8 characters, letters and a number. |
| Sign-in | Signed JWT (HS256), 12 hours. Secret from `WD_JWT_SECRET`. |
| Instant sign-out | Password change / reset, deactivation or role change raises the person's token version: old tokens stop working at once. |
| Password guessing | 10 wrong tries per email + address → 15-minute pause. Same message and time for wrong email or wrong password. |
| Access | Admin areas blocked in `SecurityConfig` **and** checked again in the services. Other people's tasks answer "not found". |
| SQL injection | Spring Data JPA with parameters only. No SQL is built from typed text. |
| Errors | Clear messages for people; stack traces and SQL never leave the server. |
| Headers / CORS | CSP, X-Frame-Options DENY, nosniff, no-referrer. Only `WD_CORS_ORIGINS` may call from a browser. |
| Two people at once | A task / FMS run is locked while it changes. Unique indexes stop the scheduler creating anything twice. |

---

## 4. Run on your computer

**Needed once:** Java 25 LTS, VS Code with *Extension Pack for Java* + *Spring Boot Extension Pack*, PostgreSQL (pgAdmin).
In pgAdmin create an empty database **`workdesk`**.

Your local settings are in `src/main/resources/application-dev.yml` (database `workdesk`, user `postgres`,
password `root`, sample data on). Change them there if yours are different.

**Start:** Spring Boot Dashboard → ▶ **workdesk-backend** (or open `WorkDeskApplication.java` → **Run**).
The `dev` profile is used automatically. Wait for `Started WorkDeskApplication`, then open
http://localhost:8082/actuator/health → `{"status":"UP"}`.

Sample sign-ins: `admin@company.com` / `Admin@123`; `priya@`, `rahul@`, `sneha@`, `amit@company.com` / `Employee@123`.

**Frontend:** in `workdesk-frontend/.env` keep `VITE_USE_MOCK=false`, run `npm run dev`, open http://localhost:5173.
(The frontend forwards `/api` to port 8082, see its `vite.config.js`.)

**Already ran the earlier (PL/pgSQL) version on this database?** Nothing to do: migration `V1001` removes the old
database functions and adds two safety indexes. Your data stays.

---

## 5. Run on a real server

Set these environment variables (see `.env.example`):

| Variable | Example |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (so dev settings and sample data are **not** used) |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | `jdbc:postgresql://db-host:5432/workdesk` |
| `WD_JWT_SECRET` | 48+ random characters |
| `WD_ADMIN_EMAIL`, `WD_ADMIN_PASSWORD` | first start only: creates the first admin |
| `WD_CORS_ORIGINS` | `https://workdesk.yourcompany.com` |
| `PORT` | `8082` |

Build and start: `mvn package` → `java -jar target/workdesk-backend-1.0.0.jar` (or use the `Dockerfile`).
Use HTTPS in front of it (Nginx, Caddy or your cloud's load balancer).

---

## 6. Tests

```
mvn test
```
A real PostgreSQL starts by itself for the tests (nothing to install).

| Test | Checks |
|---|---|
| `service/support/TaskRulesTest`, `FormValidatorTest`, `PerformanceCalculatorTest` | the rules, without a database |
| `util/OfficeTimeTest`, `CsvUtilTest` | dates in office time, safe Excel export |
| `security/JwtServiceTest`, `PasswordAndLimiterTest` | tokens, password rules, sign-in limit |
| `ApiIntegrationTest` | sign-in, security, headers, errors, main flows over HTTP |
| `BusinessRulesIntegrationTest` | review flow, own work, filters, daily/weekly copies, holidays, FMS runs, reports, notifications |

In VS Code: **Testing** panel (flask icon) → ▶ Run All.

---

## 7. API

Same addresses and JSON as the frontend's sample-data server. All need `Authorization: Bearer <token>`
except sign-in and health. Errors are always `{"status": 400, "message": "..."}`.

| Area | Endpoints |
|---|---|
| Sign in | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| People | `GET /api/people` |
| Employees (admin) | `GET/POST /api/employees`, `GET/PUT /api/employees/{id}`, `PATCH …/active?value=`, `POST …/reset-password` |
| Tasks | `GET /api/tasks?scope=&status=&assigneeId=&priority=&overdue=&q=&workFrom=&workTo=`, `POST` (single task), `POST /api/tasks/batch` (`assigneeIds` plus shared `task` including optional `reviewerId`), `POST /api/tasks/batch/approve` (`taskIds`, atomic bulk approval), `GET/PUT/DELETE /api/tasks/{id}`, `POST …/status`, `POST …/comments`, `GET …/activity`, `POST …/checklist` |
| Daily & weekly | `GET/POST /api/recurring`, `PUT/DELETE /api/recurring/{id}`, `PATCH …/active`, `POST …/generate-now` |
| Holidays | `GET /api/holidays?year=` or `?from=&to=`; admin: `POST`, `PUT/DELETE /api/holidays/{id}` |
| FMS | `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/{id}`, `PATCH …/active`, `POST …/start-now`, `GET …/{id}/runs?from=&to=`, `GET /api/workflows/runs?date=` or `?taskId=`, `GET /api/workflows/runs/{runId}`, `POST …/runs/{runId}/form` |
| Notifications | `GET /api/notifications`, `GET …/unread-count`, `POST …/{id}/read`, `POST …/read-all` |
| Reports | `GET /api/reports/dashboard`, `/team`, `/performance`, `/yearly`, `/employees`, `/employees.csv`, `/daily` |

---

## 8. Common problems

| Message | Fix |
|---|---|
| `Set WD_JWT_SECRET …` | Running without the dev profile: set `WD_JWT_SECRET` (or run with `dev`). |
| `No admin account yet. Set WD_ADMIN_PASSWORD…` | Empty database, not dev: set `WD_ADMIN_PASSWORD` for the first start. |
| `password authentication failed` / `no password was provided` | Fix the password in `application-dev.yml`. |
| `database "workdesk" does not exist` | Create it in pgAdmin. |
| `Port 8082 was already in use` | Another app uses 8082: stop it, or change `server.port` (and the port in the frontend's `vite.config.js`). |
| Frontend: "Cannot reach the server" | Backend not running, or `VITE_USE_MOCK` is still `true`. |
