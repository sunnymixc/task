#!/bin/bash

# Task Management System - Deploy Script
# Builds the frontend into static assets, embeds them into the Go binary,
# and runs the result as a single unified app.
# Usage: ./deploy.sh {build|start|stop|restart|deploy|status}

set -e

# Project configuration
PROJECT_NAME="task"
BINARY_NAME="task"
SERVER_CMD="./cmd/server/main.go"
BUILD_DIR="./bin"
PID_FILE="./.app.pid"
LOG_FILE="./logs/app.log"
FRONTEND_DIR="./frontend"
WEB_DIST_DIR="./internal/web/dist"
APP_PORT="${DEPLOY_PORT:-5010}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure required directories exist
ensure_dirs() {
    mkdir -p "$BUILD_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
}

# Log functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if the app is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Get app PID
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    fi
}

# Find the PID of whatever is listening on the app port (empty if none).
# Fallback for when the PID file is missing/stale but the app is still running.
get_port_pid() {
    local pid=""
    if command -v lsof > /dev/null 2>&1; then
        pid=$(lsof -ti "tcp:$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
    fi
    if [ -z "$pid" ] && command -v ss > /dev/null 2>&1; then
        pid=$(ss -tlnp 2>/dev/null | awk -v p=":$APP_PORT" '$4 ~ p"$"' \
            | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
    fi
    echo "$pid"
}

# Kill a PID gracefully (SIGTERM, wait up to 10s, then SIGKILL)
kill_pid_gracefully() {
    local pid="$1"
    kill "$pid" 2>/dev/null || true

    local count=0
    while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done

    if ps -p "$pid" > /dev/null 2>&1; then
        log_warn "Force killing PID $pid..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    ! ps -p "$pid" > /dev/null 2>&1
}

# Build the frontend into static assets
build_frontend() {
    log_info "Building frontend..."

    # Install deps only when package-lock.json changed (or node_modules missing)
    local hash_file="$FRONTEND_DIR/node_modules/.package-lock.hash"
    local lock_hash
    lock_hash=$(sha256sum "$FRONTEND_DIR/package-lock.json" | awk '{print $1}')
    if [ -f "$hash_file" ] && [ "$(cat "$hash_file")" = "$lock_hash" ]; then
        log_info "Frontend dependencies up-to-date, skipping install"
    else
        log_info "Installing frontend dependencies..."
        (cd "$FRONTEND_DIR" && npm ci) || {
            log_error "Frontend dependencies installation failed"
            return 1
        }
        echo "$lock_hash" > "$hash_file"
    fi

    (cd "$FRONTEND_DIR" && npm run build) || {
        log_error "Frontend build failed"
        return 1
    }

    log_info "Frontend build successful: $FRONTEND_DIR/dist"
    return 0
}

# Sync frontend build output into the Go embed directory
sync_dist() {
    log_info "Syncing frontend assets to $WEB_DIST_DIR..."

    if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
        log_error "Frontend build output missing: $FRONTEND_DIR/dist/index.html"
        return 1
    fi

    mkdir -p "$WEB_DIST_DIR"
    # Remove old assets but keep the git-tracked placeholder
    find "$WEB_DIST_DIR" -mindepth 1 ! -name '.gitkeep' -delete
    cp -r "$FRONTEND_DIR/dist/." "$WEB_DIST_DIR/"

    log_info "Frontend assets synced"
    return 0
}

# Build the backend with the frontend embedded
build_backend() {
    log_info "Building backend (with embedded frontend)..."
    ensure_dirs

    # Set Go proxy for Chinese users
    export GOPROXY=https://goproxy.cn,direct

    if go build -o "$BUILD_DIR/$BINARY_NAME" "$SERVER_CMD"; then
        log_info "Backend build successful: $BUILD_DIR/$BINARY_NAME"
        return 0
    else
        log_error "Backend build failed"
        return 1
    fi
}

# Build the unified app
build_app() {
    log_info "==================================="
    log_info "Building $PROJECT_NAME (unified app)..."
    log_info "==================================="

    build_frontend || return 1
    sync_dist || return 1
    build_backend || return 1

    log_info "==================================="
    log_info "Build complete: $BUILD_DIR/$BINARY_NAME"
    log_info "==================================="
    return 0
}

# Start the unified app
start_app() {
    if is_running; then
        log_warn "App is already running (PID: $(get_pid))"
        return 0
    fi

    if [ ! -x "$BUILD_DIR/$BINARY_NAME" ]; then
        log_error "Binary not found: $BUILD_DIR/$BINARY_NAME. Run '$0 build' first."
        return 1
    fi

    # Fail fast if the port is already taken (e.g. an orphan instance)
    local port_pid=$(get_port_pid)
    if [ -n "$port_pid" ]; then
        local port_cmd=$(ps -p "$port_pid" -o comm= 2>/dev/null | tr -d ' ')
        log_error "Port $APP_PORT is already in use by '$port_cmd' (PID: $port_pid). Run '$0 stop' first."
        return 1
    fi

    log_info "Starting $PROJECT_NAME..."

    ensure_dirs

    # Load .env file if exists
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Deploy port overrides .env (unified app listens on its own port)
    export SERVER_PORT="$APP_PORT"

    # Start app in background
    nohup "$BUILD_DIR/$BINARY_NAME" > "$LOG_FILE" 2>&1 &
    local pid=$!

    # Save PID
    echo $pid > "$PID_FILE"

    # Wait for health check
    local count=0
    while [ $count -lt 10 ]; do
        sleep 1
        if ! is_running; then
            break
        fi
        if curl -sf "http://localhost:$APP_PORT/health" > /dev/null 2>&1; then
            log_info "App started successfully (PID: $pid)"
            log_info "App: http://localhost:$APP_PORT"
            log_info "Logs: $LOG_FILE"
            return 0
        fi
        count=$((count + 1))
    done

    log_error "App failed to start. Recent logs:"
    tail -10 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
    kill "$(get_pid)" 2>/dev/null || true
    rm -f "$PID_FILE"
    return 1
}

# Stop the unified app
stop_app() {
    if ! is_running; then
        # PID file is missing/stale — check for an orphan process still holding the port
        local orphan=$(get_port_pid)
        if [ -n "$orphan" ]; then
            local orphan_cmd=$(ps -p "$orphan" -o comm= 2>/dev/null | tr -d ' ')
            if [ "$orphan_cmd" = "$BINARY_NAME" ]; then
                log_warn "No PID file, but $BINARY_NAME (PID: $orphan) is still holding port $APP_PORT; stopping it..."
                if kill_pid_gracefully "$orphan"; then
                    log_info "App stopped"
                    return 0
                else
                    log_error "Failed to stop orphan process (PID: $orphan)"
                    return 1
                fi
            else
                log_warn "Port $APP_PORT is held by unrelated process '$orphan_cmd' (PID: $orphan); not touching it"
                return 0
            fi
        fi
        log_warn "App is not running"
        return 0
    fi

    local pid=$(get_pid)
    log_info "Stopping app (PID: $pid)..."

    if ! kill_pid_gracefully "$pid"; then
        log_error "Failed to stop app"
        return 1
    fi

    # Clean up PID file
    rm -f "$PID_FILE"
    log_info "App stopped"
    return 0
}

# Restart the unified app (reuses the existing binary; run 'build' to rebuild)
restart_app() {
    log_info "Restarting $PROJECT_NAME..."
    stop_app
    sleep 1
    start_app
}

# Deploy: rebuild everything, then restart the app
deploy_app() {
    log_info "Deploying $PROJECT_NAME..."
    build_app || return 1
    restart_app
}

# Show app status
show_status() {
    echo ""
    echo "=== $PROJECT_NAME Status (unified app) ==="
    echo ""

    if is_running; then
        local pid=$(get_pid)
        echo -e "Status: ${GREEN}Running${NC}"
        echo "PID: $pid"

        # Show memory usage
        local mem=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ')
        if [ -n "$mem" ]; then
            echo "Memory: $(numfmt --to=iec $mem 2>/dev/null || echo ${mem}KB)"
        fi

        # Show uptime
        local uptime=$(ps -p "$pid" -o etime= 2>/dev/null | tr -d ' ')
        if [ -n "$uptime" ]; then
            echo "Uptime: $uptime"
        fi

        echo "Port: $APP_PORT"
        echo "URL: http://localhost:$APP_PORT"

        # Show recent logs
        echo ""
        echo "Recent logs (last 3 lines):"
        if [ -f "$LOG_FILE" ]; then
            tail -3 "$LOG_FILE" | sed 's/^/  /'
        else
            echo "  (no log file)"
        fi
    else
        echo -e "Status: ${RED}Stopped${NC}"
    fi

    echo ""
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 {build|start|stop|restart|deploy|status}

Commands:
  build    Build frontend static assets, embed them, then build the Go binary
  start    Start the unified app (does NOT auto-build; run 'build' first)
  stop     Stop the unified app
  restart  Restart the unified app (reuses the existing binary)
  deploy   Rebuild everything then restart (= build + restart)
  status   Show app status

The unified app serves both the SPA and the API from a single process
on port $APP_PORT (override with DEPLOY_PORT).

Environment:
  .env         Configuration file (DB_PASSWORD required)
  DEPLOY_PORT  Listen port (default: 5010)

Examples:
  $0 build           # Build frontend + backend into one binary
  $0 start           # Start the unified app on port $APP_PORT
  DEPLOY_PORT=8080 $0 start
  $0 deploy          # Build a new version and restart

EOF
}

# Main script
main() {
    local command="${1:-}"

    case "$command" in
        build)
            build_app
            ;;
        start)
            start_app
            ;;
        stop)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        deploy)
            deploy_app
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
