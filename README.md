# Task Management System

A task management system with user authentication, multi-tenant support, and a complete task workflow.

## Features

- **User Authentication**: JWT-based authentication with registration and login
- **Multi-Tenant**: Each user has a home tenant, and can be added to other tenants
- **Task Management**: Complete CRUD operations for tasks
- **Task Status Workflow**: Draft → Published → In Progress → Completed → Ended
- **Search**: Full-text search on tasks
- **Role-Based Access**: Owner, Admin, Contributor, Viewer roles

## Tech Stack

- **Backend**: Go 1.25+ with Gin framework
- **Database**: PostgreSQL with GORM ORM
- **Authentication**: JWT with bcrypt password hashing

## Project Structure

```
task/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── application/
│   │   ├── repository/          # Data access layer
│   │   └── service/             # Business logic layer
│   ├── config/                  # Configuration
│   ├── database/                # Database connection
│   ├── handler/                 # HTTP handlers
│   ├── middleware/              # Middleware (auth, cors)
│   ├── router/                 # Route definitions
│   └── types/                   # Models and interfaces
└── migrations/                  # Database migrations
```

## Getting Started

### Prerequisites

- Go 1.25+
- PostgreSQL 12+

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd task
```

2. Install dependencies:
```bash
go mod download
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=taskdb
JWT_SECRET=your-secret-key
```

5. Run database migrations:
```bash
psql -U postgres -d taskdb -f migrations/000001_init.up.sql
```

6. Run the server:
```bash
# Using start.sh (recommended)
./start.sh build    # Build the binary
./start.sh start    # Start the server
./start.sh status   # Check server status

# Or run directly
go run cmd/server/main.go
```

The server will start on `http://localhost:8080`

### Using start.sh

The `start.sh` script provides convenient commands for managing the server:

```bash
./start.sh start     # Start the server
./start.sh stop      # Stop the server
./start.sh restart   # Restart the server
./start.sh status    # Show server status (PID, memory, logs)
./start.sh build     # Build the binary
./start.sh rebuild   # Stop, rebuild, and leave server stopped
```

Server logs are written to `logs/server.log`.

## API Documentation

### Authentication

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Tasks

#### Create Task
```http
POST /api/v1/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Complete project",
  "description": "Finish the task management system",
  "priority": "high",
  "due_date": "2024-12-31T23:59:59Z"
}
```

#### List Tasks
```http
GET /api/v1/tasks?page=1&page_size=20&status=draft
Authorization: Bearer <token>
```

#### Get Task
```http
GET /api/v1/tasks/{id}
Authorization: Bearer <token>
```

#### Update Task
```http
PUT /api/v1/tasks/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "status": "in_progress"
}
```

#### Update Task Status
```http
PATCH /api/v1/tasks/{id}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed"
}
```

#### Delete Task
```http
DELETE /api/v1/tasks/{id}
Authorization: Bearer <token>
```

#### Search Tasks
```http
GET /api/v1/tasks/search?q=project&page=1&page_size=20
Authorization: Bearer <token>
```

## Task Status Workflow

Tasks follow this status workflow:
- **Draft** → **Published** → **In Progress** → **Completed** → **Ended**

Each status can only transition to specific allowed statuses. For example, a Draft task can only become Published or Ended.

## License

MIT
