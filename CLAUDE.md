# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tenant task management system. Go (Gin + GORM + PostgreSQL) JSON API backend with JWT auth, and a Vue 3 + TypeScript (Vite, Pinia, tdesign-vue-next) frontend. Code comments and doc strings are a mix of English and Chinese.

## Commands

The `./start.sh` script is the primary dev driver — it manages **both** the Go backend (port 5001) and the Vite frontend (port 5000), with PID files (`.backend.pid`, `.frontend.pid`) and logs in `logs/`.

```bash
./start.sh start      # build + start backend and frontend
./start.sh stop       # stop both
./start.sh restart    # restart both
./start.sh status     # show running status / ports
./start.sh build      # build backend binary only
./start.sh rebuild    # rebuild backend then restart
```

Backend-only (Makefile):
```bash
make build            # go build -o bin/task cmd/server/main.go
make run              # go run cmd/server/main.go
make test             # go test -v ./...
go test -v ./internal/application/service/...        # single package
go test -v -run TestName ./internal/...             # single test
make migrate          # go run cmd/server/main.go --migrate-only (apply pending migrations, then exit)
```

Frontend-only (from `frontend/`):
```bash
npm run dev           # Vite dev server on :5000, proxies /api and /health to :5001
npm run build         # vue-tsc type-check + vite build
```

## Configuration

Backend config is loaded from environment / `.env` (see `.env.example`) by `internal/config`. `DB_PASSWORD` is **required** (startup fails without it). Defaults: backend `SERVER_PORT=5001`, Postgres on `localhost:5432`, `JWT_EXPIRATION=15` minutes. The Vite dev server hardcodes port 5000 and proxies to the backend at `localhost:5001`.

## Database & migrations

There is **no GORM AutoMigrate** — the schema is managed by raw SQL in `migrations/`. Migrations are **embedded into the binary** (`migrations/embed.go`, `go:embed`) and **applied automatically at server startup** by `internal/database/migrate.go`: each `NNNNNN_*.up.sql` not yet recorded in the `schema_migrations` table runs in its own transaction (guarded by a Postgres advisory lock against concurrent starts), then its numeric version is recorded. `./bin/task --migrate-only` (or `make migrate`) runs migrations and exits.

When changing a model in `internal/types`, write a corresponding migration; the struct's GORM tags alone won't alter the DB. New migrations must be **idempotent** (`IF NOT EXISTS` / `DO $$` guards) and must not use non-transactional DDL (`CREATE INDEX CONCURRENTLY`). Rebuild the binary after adding SQL — files are embedded at build time. For an existing DB that's already current, baseline by inserting its versions into `schema_migrations` instead of re-running.

Soft deletes are used (`gorm.DeletedAt`). All times are stored UTC (`database.Init` sets `NowFunc` to `time.Now().UTC()`).

## Backend architecture

Layered, with interfaces defined in `internal/types/interfaces/` and implementations wired in `internal/router/router.go`:

```
handler  → service → repository → GORM (global database.DB)
(HTTP)     (logic)    (data)
```

- **`internal/router`** — single `Setup(cfg)` constructs services + handlers and registers routes under `/api/v1`. This is the dependency-injection entry point.
- **`internal/handler`** — Gin handlers. Each handler defines its **own** request structs (`CreateTaskRequest`, etc.) with `binding` validation tags, then maps them to the parallel `types.*Request` DTOs before calling the service. Note this duplication: there are request structs in both `internal/handler/task.go` and `internal/types/task.go`. Date strings from the client are parsed via `parseDueDate` (multiple accepted layouts) in the handler.
- **`internal/application/service`** — business logic. Returns sentinel errors (`ErrTaskNotFound`, `ErrInvalidStatusTransition`) for handlers to map to HTTP codes.
- **`internal/application/repository`** — GORM data access. Repositories grab the **global** `database.GetDB()` at construction (no DB passed in). Each call uses `.WithContext(ctx)`.
- **`internal/types`** — GORM models, enums, DTOs, and `ToResponse()` mappers (models → `*Response` shapes for the API).

### Auth & tenancy (important)

- `internal/middleware/auth.go` validates the JWT and stashes `user_id`, `email`, `tenant_id` into the Gin context. It is applied **globally**; public routes are whitelisted in the `noAuthAPI` map (`/health`, `/api/v1/auth/{register,login,refresh}`) — **add new public endpoints there.**
- The middleware also injects the user ID into the **request `context.Context`** via `service.SetContextUserID`. Service code reads it back with the unexported `getContextUserID(ctx)` — this is how services know the current user without a parameter. A handler that calls a service requiring identity must pass `c.Request.Context()`.
- Tenant isolation: services resolve the current user's `TenantID` from the user record and pass it to tenant-scoped repository queries. Note there are existing `// TODO: Verify tenant access` gaps in `service/task.go` (Get/Update/Delete don't yet check the task's tenant against the caller's) — be aware when touching those paths.

### Task status

`types.TaskStatus` defines the workflow Draft → Published → In Progress → Completed → Ended, and `ValidStatusTransitions` / `IsValidTransition` encode the allowed transitions. **However**, transition validation is currently NOT enforced — `UpdateTask` and `UpdateTaskStatus` set status freely (a recent change removed the check; see commit history). Don't assume the guard runs unless you re-add it.

## Frontend architecture

Vue 3 `<script setup>` SPA in `frontend/src`:

- **`utils/request.ts`** — axios instance (`baseURL: /api`). Request interceptor attaches the JWT from `localStorage` (`task_token`); response interceptor unwraps `response.data`, surfaces errors via tdesign `MessagePlugin`, and implements automatic token refresh with a queued-retry mechanism for concurrent 401s.
- **`api/`** — thin per-domain wrappers (`auth.ts`, `task.ts`) over `request`.
- **`stores/`** — Pinia stores (`auth`, `task`, `ui`) hold app state.
- **`views/`** + **`components/task/`** — pages and task UI widgets; `router/index.ts` defines routes (auth-guarded layout).

## Specs

`specs/` holds design/refactor notes (`frontend-appname.md`, `ui-refactor.md`) referenced during feature work.
