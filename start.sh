#!/bin/bash

# Task Management System - Start Script
# Usage: ./start.sh {start|stop|restart|status|build|rebuild}

set -e

# Project configuration
PROJECT_NAME="task"
BINARY_NAME="task"
SERVER_CMD="./cmd/server/main.go"
BUILD_DIR="./bin"
PID_FILE="./.pid"
LOG_FILE="./logs/server.log"

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

# Check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is not running
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Get server PID
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    fi
}

# Build the application
build_app() {
    log_info "Building $PROJECT_NAME..."
    ensure_dirs

    # Set Go proxy for Chinese users
    export GOPROXY=https://goproxy.cn,direct

    if go build -o "$BUILD_DIR/$BINARY_NAME" "$SERVER_CMD"; then
        log_info "Build successful: $BUILD_DIR/$BINARY_NAME"
        return 0
    else
        log_error "Build failed"
        return 1
    fi
}

# Start the server
start_server() {
    if is_running; then
        log_warn "$PROJECT_NAME is already running (PID: $(get_pid))"
        return 0
    fi

    log_info "Starting $PROJECT_NAME..."

    # Check if binary exists, build if not
    if [ ! -f "$BUILD_DIR/$BINARY_NAME" ]; then
        log_info "Binary not found, building..."
        build_app || exit 1
    fi

    ensure_dirs

    # Load .env file if exists
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Start server in background
    nohup "$BUILD_DIR/$BINARY_NAME" > "$LOG_FILE" 2>&1 &
    local pid=$!

    # Save PID
    echo $pid > "$PID_FILE"

    # Wait a moment and check if it's still running
    sleep 2
    if is_running; then
        log_info "$PROJECT_NAME started successfully (PID: $pid)"
        log_info "Logs: $LOG_FILE"
        return 0
    else
        log_error "$PROJECT_NAME failed to start. Check $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Stop the server
stop_server() {
    if ! is_running; then
        log_warn "$PROJECT_NAME is not running"
        return 0
    fi

    local pid=$(get_pid)
    log_info "Stopping $PROJECT_NAME (PID: $pid)..."

    # Send SIGTERM
    kill "$pid" 2>/dev/null || true

    # Wait for graceful shutdown (max 10 seconds)
    local count=0
    while is_running && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done

    # Force kill if still running
    if is_running; then
        log_warn "Force killing $PROJECT_NAME..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    # Clean up PID file
    rm -f "$PID_FILE"

    if is_running; then
        log_error "Failed to stop $PROJECT_NAME"
        return 1
    else
        log_info "$PROJECT_NAME stopped"
        return 0
    fi
}

# Restart the server
restart_server() {
    log_info "Restarting $PROJECT_NAME..."
    stop_server
    sleep 1
    start_server
}

# Show server status
show_status() {
    echo ""
    echo "=== $PROJECT_NAME Status ==="

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

        # Show port from config
        local port=${SERVER_PORT:-8080}
        echo "Port: $port"
        echo "URL: http://localhost:$port"

        # Show recent logs
        echo ""
        echo "Recent logs (last 5 lines):"
        if [ -f "$LOG_FILE" ]; then
            tail -5 "$LOG_FILE" | sed 's/^/  /'
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
    build_app || exit 1
    log_info "$PROJECT_NAME rebuilt. Run '$0 start' to start."
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 {start|stop|restart|status|build|rebuild}

Commands:
  start    Start the server
  stop     Stop the server
  restart  Restart the server
  status   Show server status
  build    Build the application
  rebuild  Stop, rebuild the application

Environment:
  .env     Configuration file (optional)

Examples:
  $0 start          # Start server
  $0 status         # Check status
  $0 restart        # Restart server
  $0 rebuild        # Rebuild and leave stopped

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
            build_app
            ;;
        rebuild)
            rebuild_app
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
