# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tenant task management system. Go (Gin + GORM + PostgreSQL) JSON API backend with JWT auth, and a React 19 + TypeScript (Vite, zustand, react-router v7, Semi Design via `@douyinfe/semi-ui-19`) frontend. Code comments and doc strings are a mix of English and Chinese. (The previous Vue 3 + tdesign frontend is preserved at `frontend-vue-legacy/` as a rollback; swap the two directories back to revert.)

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
npm run build         # tsc -b type-check + vite build
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

`types.TaskStatus` defines the workflow Draft → Pending → Executing → Completed (wire values `draft` / `pending` / `executing` / `completed`), and `ValidStatusTransitions` / `IsValidTransition` encode the allowed transitions. **However**, transition validation is currently NOT enforced — `UpdateTask` and `UpdateTaskStatus` set status freely (a recent change removed the check; see commit history). Don't assume the guard runs unless you re-add it.

## Frontend architecture

React 19 SPA in `frontend/src` (Semi Design UI via `@douyinfe/semi-ui-19`, react-router v7 library mode, zustand state):

- **`main.tsx`** — bootstrap order matters: `@douyinfe/semi-ui-19/react19-adapter` **must** be imported before any Semi component (injects `createRoot` for imperative Toast/Modal APIs), then Semi's `dist/css/semi.min.css` (resolved via a vite alias because the package's `exports` map omits `dist/`), then `assets/theme.css` (overrides Semi tokens on `body` — brand blue via the `--semi-blue-*` palette). The app runs **without** `StrictMode`: Semi's imperative modals (`Modal.useModal`) don't mount under React 19 StrictMode double-rendering.
- **`utils/request.ts`** — axios instance (`baseURL: /api`). Request interceptor attaches the JWT from `localStorage` (`task_token`); response interceptor unwraps `response.data`, surfaces errors via Semi `Toast`, and implements automatic token refresh with a queued-retry mechanism for concurrent 401s.
- **`api/`** — thin per-domain wrappers (`auth.ts`, `task.ts`) over `request`.
- **`stores/`** — zustand stores (`auth`, `task`, `taskList`, `taskFilter`, `ui`). Non-component access via `useXxxStore.getState()`. `ui` applies the runtime border-radius setting by writing `--semi-border-radius-*` inline on `documentElement` (server-authoritative via `/v1/settings`, cached in `localStorage` `task_radius`).
- **`views/`** + **`components/`** — pages and widgets; `router/index.tsx` defines routes (`RequireAuth` wrapper, lazy views). Styling is CSS Modules per component plus `styles/semi-overrides.css` for teleported Semi layers.
- **Form dialogs** — `TaskForm`/`TaskListForm` expose imperative handles (`useImperativeHandle`: `submit`/`save`/`focusTitle`/`getCopyText`) driven by parent Modal footer buttons; parents remount forms per open via `key`, and Semi Table pagination must stay fully controlled (`currentPage` passed) so it never client-slices server pages.

### Table pages (standard)

The app shell is a fixed `100vh` (`html/body/#root` are `overflow: hidden` — the window never scrolls); each page owns its scrolling. All table pages (`views/task/TaskList.tsx`, `views/task-list/TaskListManage.tsx`) follow one recipe — reuse it for any new table page:

- **Page skeleton**: `.container` (flex column, `height: 100%`, padding) → `.pageHeader` → optional `.filters` → `.tableContainer` (`flex: 1; min-height: 0; overflow: hidden`) → `<Table>`. The flex layout makes `.tableContainer` equal "window minus title/filters/spacing" with no manual math.
- **Fixed header/footer, scrolling body**: pass `scroll={scrollY !== undefined ? { y: scrollY } : undefined}` computed by the shared hook **`hooks/useTableScrollY.ts`** (`const { containerRef, scrollY } = useTableScrollY(); <div ref={containerRef}>`). The hook measures container minus header minus pagination and re-computes via ResizeObserver + window `resize`. With `scroll.y`, Semi renders a separate fixed head table and gives `.semi-table-body` a `max-height`; the pagination bar sits outside the scroll area and stays fixed. Do **not** re-add CSS `position: sticky` thead hacks.
- **No `scroll.x`**: Semi syncs head/body `scrollLeft` unconditionally. Horizontal scroll on narrow windows comes from a CSS `min-width` on `.semi-table table` (sum of fixed column widths) — it hits both inner tables, keeping columns aligned while still stretching on wide screens.
- **Empty state**: pass it via the Table `empty` prop (gated `loading ? null : <custom/>`), never as a sibling below the Table — a sibling gets pushed out by the fixed-height table and duplicates Semi's built-in placeholder.
- **Custom scrollbars**: style `.tableContainer :global(.semi-table-body)` (the real scroller), not the container.
- **Sticky columns**: keep CSS-sticky cells via a column `className` (applied to both th and td) rather than Semi `fixed:` (heavier cloned-table path) — but the selector must out-rank Semi's 3-class `.semi-table-tbody>.semi-table-row>.semi-table-row-cell { position: relative }`, e.g. `.tableContainer :global(.semi-table) td.actionCell` (see TaskListManage.module.css).
- **Pagination**: fully controlled (`currentPage`, `total`, `onPageChange` → server fetch), per the rule above.

## Specs

`specs/` holds design/refactor notes (`frontend-appname.md`, `ui-refactor.md`) referenced during feature work.
