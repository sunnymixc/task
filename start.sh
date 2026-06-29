#!/bin/bash

# Task Management System - Start Script
# Usage: ./start.sh {start|stop|restart|status|build|rebuild}

set -e

# Project configuration
PROJECT_NAME="task"
BINARY_NAME="task"
SERVER_CMD="./cmd/server/main.go"
BUILD_DIR="./bin"
BACKEND_PID_FILE="./.backend.pid"
FRONTEND_PID_FILE="./.frontend.pid"
BACKEND_LOG_FILE="./logs/backend.log"
FRONTEND_LOG_FILE="./logs/frontend.log"
FRONTEND_DIR="./frontend"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure required directories exist
ensure_dirs() {
    mkdir -p "$BUILD_DIR"
    mkdir -p "$(dirname "$BACKEND_LOG_FILE")"
    mkdir -p "$(dirname "$FRONTEND_LOG_FILE")"
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

# Check if backend is running
is_backend_running() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$BACKEND_PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Check if frontend is running
is_frontend_running() {
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$FRONTEND_PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Check if any service is running
is_any_running() {
    is_backend_running || is_frontend_running
}

# Get backend PID
get_backend_pid() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        cat "$BACKEND_PID_FILE"
    fi
}

# Get frontend PID
get_frontend_pid() {
    if [ -f "$FRONTEND_PID_FILE" ]; then
        cat "$FRONTEND_PID_FILE"
    fi
}

# Build the backend application
build_backend() {
    log_info "Building backend..."
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

# Build/install the frontend
build_frontend() {
    log_info "Preparing frontend..."

    # Check if node_modules exists, install if not
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log_info "Installing frontend dependencies..."
        (cd "$FRONTEND_DIR" && npm install) || {
            log_error "Frontend dependencies installation failed"
            return 1
        }
    else
        log_info "Frontend dependencies already installed"
    fi

    log_info "Frontend ready"
    return 0
}

# Build both backend and frontend
build_all() {
    log_info "==================================="
    log_info "Building $PROJECT_NAME..."
    log_info "==================================="

    build_backend || return 1
    build_frontend || return 1

    log_info "==================================="
    log_info "Build complete!"
    log_info "==================================="
    return 0
}

# Start the backend server
start_backend() {
    if is_backend_running; then
        log_warn "Backend is already running (PID: $(get_backend_pid))"
        return 0
    fi

    log_info "Starting backend..."

    ensure_dirs

    # Load .env file if exists
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Start backend in background
    nohup "$BUILD_DIR/$BINARY_NAME" > "$BACKEND_LOG_FILE" 2>&1 &
    local pid=$!

    # Save PID
    echo $pid > "$BACKEND_PID_FILE"

    # Wait a moment and check if it's still running
    sleep 2
    if is_backend_running; then
        log_info "Backend started successfully (PID: $pid)"
        log_info "Backend logs: $BACKEND_LOG_FILE"
        return 0
    else
        log_error "Backend failed to start. Check $BACKEND_LOG_FILE"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

# Start the frontend dev server
start_frontend() {
    if is_frontend_running; then
        log_warn "Frontend is already running (PID: $(get_frontend_pid))"
        return 0
    fi

    log_info "Starting frontend..."

    ensure_dirs

    # Start frontend dev server in background
    cd "$FRONTEND_DIR"
    nohup npm run dev > "../$FRONTEND_LOG_FILE" 2>&1 &
    local pid=$!
    cd ..

    # Save PID
    echo $pid > "$FRONTEND_PID_FILE"

    # Wait a moment and check if it's still running
    sleep 3
    if is_frontend_running; then
        log_info "Frontend started successfully (PID: $pid)"
        log_info "Frontend logs: $FRONTEND_LOG_FILE"
        return 0
    else
        log_error "Frontend failed to start. Check $FRONTEND_LOG_FILE"
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

# Start both backend and frontend
start_server() {
    # Build before starting
    build_all || {
        log_error "Build failed, cannot start services"
        return 1
    }

    start_backend || return 1
    start_frontend || return 1

    echo ""
    log_info "==================================="
    log_info "All services started successfully!"
    log_info "==================================="
    log_info "Backend:  http://localhost:5001"
    log_info "Frontend: http://localhost:5000"
    log_info "==================================="
}

# Stop the backend server
stop_backend() {
    if ! is_backend_running; then
        log_warn "Backend is not running"
        return 0
    fi

    local pid=$(get_backend_pid)
    log_info "Stopping backend (PID: $pid)..."

    # Send SIGTERM
    kill "$pid" 2>/dev/null || true

    # Wait for graceful shutdown (max 10 seconds)
    local count=0
    while is_backend_running && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done

    # Force kill if still running
    if is_backend_running; then
        log_warn "Force killing backend..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    # Clean up PID file
    rm -f "$BACKEND_PID_FILE"

    if is_backend_running; then
        log_error "Failed to stop backend"
        return 1
    else
        log_info "Backend stopped"
        return 0
    fi
}

# Stop the frontend server
stop_frontend() {
    if ! is_frontend_running; then
        log_warn "Frontend is not running"
        return 0
    fi

    local pid=$(get_frontend_pid)
    log_info "Stopping frontend (PID: $pid)..."

    # Send SIGTERM
    kill "$pid" 2>/dev/null || true

    # Wait for graceful shutdown (max 10 seconds)
    local count=0
    while is_frontend_running && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done

    # Force kill if still running
    if is_frontend_running; then
        log_warn "Force killing frontend..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    # Clean up PID file
    rm -f "$FRONTEND_PID_FILE"

    if is_frontend_running; then
        log_error "Failed to stop frontend"
        return 1
    else
        log_info "Frontend stopped"
        return 0
    fi
}

# Stop both backend and frontend
stop_server() {
    stop_backend
    stop_frontend
    log_info "All services stopped"
}

# Restart the server
restart_server() {
    log_info "Restarting $PROJECT_NAME..."
    stop_server
    sleep 1

    # Build before starting
    build_all || {
        log_error "Build failed, cannot start services"
        return 1
    }

    start_backend || return 1
    start_frontend || return 1

    echo ""
    log_info "==================================="
    log_info "All services restarted successfully!"
    log_info "==================================="
    log_info "Backend:  http://localhost:5001"
    log_info "Frontend: http://localhost:5000"
    log_info "==================================="
}

# Show server status
show_status() {
    echo ""
    echo "=== $PROJECT_NAME Status ==="
    echo ""

    # Backend status
    echo "--- Backend ---"
    if is_backend_running; then
        local pid=$(get_backend_pid)
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

        # Show port from config
        local port=${SERVER_PORT:-5001}
        echo "Port: $port"
        echo "URL: http://localhost:$port"

        # Show recent logs
        echo ""
        echo "Recent logs (last 3 lines):"
        if [ -f "$BACKEND_LOG_FILE" ]; then
            tail -3 "$BACKEND_LOG_FILE" | sed 's/^/  /'
        else
            echo "  (no log file)"
        fi
    else
        echo -e "Status: ${RED}Stopped${NC}"
    fi

    echo ""
    echo "--- Frontend ---"
    if is_frontend_running; then
        local pid=$(get_frontend_pid)
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

        echo "Port: 5000"
        echo "URL: http://localhost:5000"

        # Show recent logs
        echo ""
        echo "Recent logs (last 3 lines):"
        if [ -f "$FRONTEND_LOG_FILE" ]; then
            tail -3 "$FRONTEND_LOG_FILE" | sed 's/^/  /'
        else
            echo "  (no log file)"
        fi
    else
        echo -e "Status: ${RED}Stopped${NC}"
    fi

    echo ""
}

# Rebuild the application
rebuild_app() {
    log_info "Rebuilding $PROJECT_NAME..."
    stop_server
    build_all || exit 1

    # Clear node_modules cache (optional)
    if [ "$1" = "--clean" ]; then
        log_info "Cleaning frontend node_modules..."
        rm -rf "$FRONTEND_DIR/node_modules"
        log_info "Run '$0 start' to reinstall and start"
    else
        log_info "$PROJECT_NAME rebuilt. Run '$0 start' to start."
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 {start|stop|restart|status|build|rebuild}

Commands:
  start    Build and start both backend and frontend servers
  stop     Stop both backend and frontend servers
  restart  Stop, rebuild, and start both backend and frontend servers
  status   Show status of all services
  build    Build both backend and frontend
  rebuild  Stop, clean rebuild both backend and frontend (leaves stopped)

Services:
  Backend:  Go API server (port 5001)
  Frontend: Vite dev server (port 5000)

Environment:
  .env     Configuration file (optional)

Examples:
  $0 start          # Build and start all services
  $0 status         # Check status of all services
  $0 restart        # Rebuild and restart all services
  $0 rebuild        # Clean rebuild and leave stopped
  $0 rebuild --clean # Clean rebuild including node_modules

EOF
}

# Main script
main() {
    local command="${1:-}"

    case "$command" in
        start)
            start_server
            ;;
        stop)
            stop_server
            ;;
        restart)
            restart_server
            ;;
        status)
            show_status
            ;;
        build)
            build_all
            ;;
        rebuild)
            rebuild_app "$2"
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
