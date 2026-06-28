.PHONY: help build run test clean deps migrate

help:
	@echo "Available commands:"
	@echo "  make deps     - Download dependencies"
	@echo "  make build    - Build the application"
	@echo "  make run      - Run the application"
	@echo "  make test     - Run tests"
	@echo "  make clean    - Clean build artifacts"
	@echo "  make migrate  - Run database migrations"

deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

build:
	@echo "Building application..."
	go build -o bin/task cmd/server/main.go

run:
	@echo "Running application..."
	go run cmd/server/main.go

test:
	@echo "Running tests..."
	go test -v ./...

clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/

migrate:
	@echo "Running database migrations..."
	psql -U $(DB_USER) -d $(DB_NAME) -f migrations/000001_init.up.sql
