# Time Reporting System

מערכת ניהול דוחות זמן עבודה מלאה עבור ניהול פרויקטים וחשבונאות שעות עבודה.

A comprehensive time reporting system for managing work hours, projects, absences, and team analytics.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Available npm Scripts](#-available-npm-scripts)
- [API Documentation](#api-documentation)
- [API Examples](#-api-examples-with-curl)
- [Features Deep Dive](#-features-deep-dive)
- [Project Structure](#project-structure)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Development Workflow](#-development-workflow)
- [Architecture](#-system-architecture)
- [Security Best Practices](#-security-best-practices)
- [Rate Limiting](#-rate-limiting-details)
- [File Uploads](#-file-upload-specifications)
- [HTTP Status Codes & Error Handling](#-http-status-codes--error-handling)
- [FAQ](#-faq)
- [Monitoring & Logging](#-monitoring--logging)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This is a full-stack time-reporting application that allows teams to:

- Track daily time entries by project and task
- Request and manage absences (vacation, sick leave, etc.)
- View time summaries and monthly reports
- Lock months for final accounting
- Manage user roles and permissions
- Audit all system changes

**Main Features:**

- ✅ User authentication (JWT-based)
- ✅ Time entry tracking with timer support
- ✅ Project and task management
- ✅ Absence request workflows
- ✅ Monthly reporting and summaries
- ✅ Admin dashboard
- ✅ Audit logging
- ✅ Role-based access control (RBAC)
- ✅ Month locking for closed accounting periods

---

## ⚡ Quick Start

**Get up and running in 5 minutes:**

```bash
# 1. Clone and enter directory
git clone <repo-url> && cd time-reporting-system

# 2. Install dependencies
cd server && npm install && cd ..

# 3. Start PostgreSQL (Docker)
docker-compose up -d postgres

# 4. Copy and fill .env
cp server/.env.example server/.env

# 5. Run migrations and seed
cd server && npm run migrate && npm run seed && cd ..

# 6. Start development server
cd server && npm run dev

# Access at http://localhost:5000
# Login: Check seeded users in seeds/
# Swagger: http://localhost:5000/api/docs (admin only)
```

---

## 🛠 Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js (TypeScript)
- **Language**: TypeScript 5.4+
- **Database**: PostgreSQL 12+
- **ORM**: Knex.js (query builder)
- **Authentication**: JWT (jsonwebtoken)
- **API Documentation**: Swagger/OpenAPI 3.0 (swagger-jsdoc)

### Frontend

- **Framework**: React (TypeScript)
- **RTL Support**: Hebrew layout with RTL CSS
- **Build**: Create React App (react-scripts)

### DevOps

- **Containerization**: Docker + Docker Compose
- **Testing**: Jest (unit & integration tests)
- **Linting**: ESLint with TypeScript support

## 💻 Installation

### Prerequisites

- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher
- **PostgreSQL**: 12 or higher
- **Docker & Docker Compose**: (optional, for database)
- **Git**: for version control

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/time-reporting-system.git
cd time-reporting-system
```

### Step 2: Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### Step 3: Set Up PostgreSQL Database

**Option A: Using Docker Compose (Recommended)**

```bash
docker-compose up -d postgres
```

This starts a PostgreSQL instance on `localhost:5432` with:

- Database: `time_reporting`
- User: `postgres`
- Password: `postgres` (configured in docker-compose.yml)

**Option B: Local PostgreSQL Installation**

```bash
# Create database and user
createdb time_reporting
createuser -s postgres
```

### Step 4: Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```bash
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=time_reporting
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secrets
JWT_ACCESS_SECRET=your-super-secret-access-key-here-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-min-32-chars

# CORS
CORS_ORIGIN=http://localhost:5173

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

### Step 5: Run Database Migrations

```bash
cd server
npm run migrate
```

This will create all required tables and indexes in PostgreSQL.

### Step 6: Seed Initial Data (Optional)

```bash
npm run seed
```

This creates test users and sample data for development.

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Start PostgreSQL (if using Docker):**

```bash
docker-compose up postgres
```

**Terminal 2 - Start Server:**

```bash
cd server
npm run dev
```

Server runs on: `http://localhost:5000`

**Terminal 3 - Start Frontend:**

```bash
cd frontend
npm start
```

Frontend runs on: `http://localhost:3000`

### Production Build & Run

**Build:**

```bash
# Server
cd server
npm run build

# Frontend
cd ../frontend
npm run build
```

**Run:**

```bash
cd server
npm start
```

## ⚙️ Available npm Scripts

### Server Scripts

Run these commands from the `server/` directory:

| Command                       | Purpose                                            |
| ----------------------------- | -------------------------------------------------- |
| `npm run dev`                 | Start development server with hot reload (ts-node) |
| `npm run build`               | Compile TypeScript to JavaScript                   |
| `npm start`                   | Run production build                               |
| `npm test`                    | Run all tests (unit + integration)                 |
| `npm run test:unit`           | Run unit tests only                                |
| `npm run test:integration`    | Run integration tests only                         |
| `npm run test:watch`          | Run tests in watch mode                            |
| `npm run test:coverage`       | Generate test coverage report                      |
| `npm run test:docker`         | Run tests with real PostgreSQL in Docker           |
| `npm run test:docker:reset`   | Reset Docker test database                         |
| `npm run lint`                | Run ESLint                                         |
| `npm run lint:fix`            | Auto-fix linting issues                            |
| `npm run format`              | Format code with Prettier                          |
| `npm run migrate`             | Run pending database migrations                    |
| `npm run migrate:status`      | Show migration status                              |
| `npm run migrate:rollback`    | Rollback last migration                            |
| `npm run migrate:make <name>` | Create new migration file                          |
| `npm run seed`                | Run database seeders                               |
| `npm run seed:make <name>`    | Create new seeder file                             |

**Example:**

```bash
cd server
npm run dev              # Start dev server
npm run lint:fix        # Fix code style
npm test                # Run all tests
npm run migrate:make add_new_column  # Create migration
```

---

## 📚 API Documentation

### Swagger UI

The complete REST API is documented with Swagger/OpenAPI 3.0.

Available at **http://localhost:3001/docs** — admin accounts only.

**Accessing the Documentation:**

1. Start the development server: `npm run dev` (in `server/` directory)
2. Log in to the app at http://localhost:3002 as an admin
3. Open http://localhost:3001/docs in the same browser
4. Swagger UI auto-authorizes using your existing session — no manual token copy-paste needed
5. Export OpenAPI spec: `http://localhost:3001/api/openapi.json`

### Key API Endpoints

#### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/change-password` - Change password

#### Time Entries

- `GET /api/time-entries` - List time entries
- `POST /api/time-entries` - Create time entry
- `PUT /api/time-entries/:id` - Update time entry
- `DELETE /api/time-entries/:id` - Delete time entry

#### Timer

- `POST /api/timer/start` - Start work timer
- `POST /api/timer/stop` - Stop timer and create entry
- `GET /api/timer/status` - Get current timer status

#### Absences

- `GET /api/absences` - List absences
- `POST /api/absences` - Request absence
- `PUT /api/absences/:id` - Update absence
- `DELETE /api/absences/:id` - Cancel absence

#### Users (Admin)

- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

#### Projects & Tasks

- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (admin)
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task (admin)

#### Reports

- `GET /api/monthly-summary` - Monthly time summary
- `GET /api/audit-logs` - Audit logs (admin-only)

#### Admin

- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/months` - List month locks (admin)
- `POST /api/admin/months/:year/:month/lock` - Lock month (admin)

See full documentation in Swagger UI at `/api/docs`

---

## 📡 API Examples (with curl)

### Authentication

**Login:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'

# Response:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
# }
```

**Refresh Token:**

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Cookie: refreshToken=<refresh_token>"

# Response: { "accessToken": "new_token..." }
```

**Change Password:**

```bash
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "oldPassword",
    "newPassword": "newPassword123!"
  }'
```

### Time Entries

**Create Time Entry:**

```bash
curl -X POST http://localhost:5000/api/time-entries \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "task_id": 5,
    "date": "2024-05-13",
    "hours": 8.5,
    "description": "Implemented authentication"
  }'
```

**List Time Entries:**

```bash
curl -X GET "http://localhost:5000/api/time-entries?date=2024-05-13" \
  -H "Authorization: Bearer <access_token>"
```

**Update Time Entry:**

```bash
curl -X PUT http://localhost:5000/api/time-entries/42 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hours": 7.5,
    "description": "Updated description"
  }'
```

**Delete Time Entry:**

```bash
curl -X DELETE http://localhost:5000/api/time-entries/42 \
  -H "Authorization: Bearer <access_token>"
```

### Timer

**Start Timer:**

```bash
curl -X POST http://localhost:5000/api/timer/start \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "task_id": 5
  }'

# Response: { "id": 1, "project_id": 1, "started_at": "2024-05-13T10:30:00Z" }
```

**Stop Timer:**

```bash
curl -X POST http://localhost:5000/api/timer/stop \
  -H "Authorization: Bearer <access_token>"

# Response: { "id": 42, "hours": 2.5, "created_at": "2024-05-13T10:30:00Z" }
```

**Check Timer Status:**

```bash
curl -X GET http://localhost:5000/api/timer/status \
  -H "Authorization: Bearer <access_token>"

# Response: { "is_running": true, "started_at": "...", "elapsed_seconds": 3600 }
```

### Absences

**Request Absence:**

```bash
curl -X POST http://localhost:5000/api/absences \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "vacation",
    "start_date": "2024-06-01",
    "end_date": "2024-06-07",
    "description": "Summer vacation"
  }'
```

**Upload Absence Document:**

```bash
curl -X POST http://localhost:5000/api/absences/1/documents \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@/path/to/document.pdf"
```

### Users (Admin Only)

**Create User:**

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "John Doe",
    "role": "employee",
    "hourly_rate": 50
  }'
```

**List All Users:**

```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer <admin_token>"
```

**Update User:**

```bash
curl -X PUT http://localhost:5000/api/users/3 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "manager",
    "hourly_rate": 60
  }'
```

**Reset User Password:**

```bash
curl -X POST http://localhost:5000/api/users/3/reset-password \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "TempPassword123!"
  }'
```

### Month Locking (Admin Only)

**Lock a Month:**

```bash
curl -X POST http://localhost:5000/api/admin/months/2024/5/lock \
  -H "Authorization: Bearer <admin_token>"

# Response: { "is_locked": true, "locked_at": "2024-05-31T17:00:00Z" }
```

**Unlock a Month:**

```bash
curl -X POST http://localhost:5000/api/admin/months/2024/5/unlock \
  -H "Authorization: Bearer <admin_token>"
```

**List All Months:**

```bash
curl -X GET http://localhost:5000/api/admin/months \
  -H "Authorization: Bearer <admin_token>"
```

### Reports

**Get Monthly Summary:**

```bash
curl -X GET "http://localhost:5000/api/monthly-summary?year=2024&month=5" \
  -H "Authorization: Bearer <access_token>"

# Response:
# {
#   "year": 2024,
#   "month": 5,
#   "total_hours": 160,
#   "total_entries": 21,
#   "by_project": [...],
#   "by_day": [...]
# }
```

**Get Audit Logs (Admin):**

```bash
curl -X GET "http://localhost:5000/api/audit-logs?limit=50&offset=0" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🎯 Features Deep Dive

### Time Entry Management

**Creating Entries:**

- Users can create time entries for past, current, or future dates (if month not locked)
- Entries must have: project, date, and hours
- Task is optional
- Description is optional for notes

**Locked Months:**

- Once a month is locked (by admin), users cannot create/edit/delete entries in that month
- Locked months are indicated in the UI with a padlock icon
- Admins can unlock months if needed for corrections

**Status Flow:**

```
draft → submitted → approved
                 → rejected
```

**Quotas & Limits:**

- Maximum 12 hours per day (configurable)
- Entries cannot have 0 hours
- Decimal hours supported (e.g., 7.5, 3.25)

### Timer Functionality

**How It Works:**

1. User clicks "Start Timer" for a project/task
2. Timer runs in background, elapsed time displayed in UI
3. User clicks "Stop Timer" — automatically creates time entry for elapsed time
4. Time entry is in "draft" status, ready for review/editing

**Real-Time Sync:**

- Timer status synced via `GET /api/timer/status` polls every 10 seconds
- Only one timer can run at a time per user
- Stopping timer immediately creates a time entry

### Absence Request Workflow

**Types Supported:**

- `sick` - Sick leave (requires medical cert after 3 consecutive days)
- `vacation` - Planned vacation
- `personal` - Personal days
- `other` - Other absences

**Request → Approval Flow:**

1. Employee creates request with date range
2. Request status: `pending`
3. Manager/Admin reviews and approves or rejects
4. Once approved, dates are marked as absence on reports
5. If rejected, employee notified and can resubmit

**Document Attachments:**

- Upload medical certificates, doctor notes, or justifications
- Max 10MB per file
- Supported: PDF, JPG, PNG, DOCX
- Stored in `uploads/` directory with UUID naming

### Month Locking

**Purpose:**

- Finalize accounting for a given month
- Prevent accidental changes to closed periods
- Maintain audit trail of locked months

**What Gets Locked:**

- Creating/editing/deleting time entries in locked month
- Creating/editing absences in locked month
- Monthly summary becomes "final"

**Admin Actions:**

- Lock: `POST /api/admin/months/:year/:month/lock`
- Unlock: `POST /api/admin/months/:year/:month/unlock`
- View all: `GET /api/admin/months`

**Best Practice:**

- Lock month on last day of month or first week of next month
- Keep previous 6 months locked to prevent tampering

### Audit Logging

**What's Tracked:**

- User login/logout
- Create, update, delete actions on all entities
- Who made the change
- What changed (old value → new value)
- Timestamp of change

**Queryable By:**

- `action` - CREATE, UPDATE, DELETE, LOGIN, etc.
- `entity_type` - users, time_entries, absences, etc.
- `user_id` - who made the change
- Date range

**Use Cases:**

- Compliance audits
- Track who edited a time entry
- Verify account modifications
- Dispute resolution

### Permission Flags

**System:**

- RBAC (Role-based) + Fine-grained flags
- Users have role (admin/manager/employee) + optional flags
- Flags can grant additional permissions beyond role

**Examples:**

- `CAN_APPROVE_ABSENCES` - Employee can approve others' absences
- `CAN_EXPORT_PAYROLL` - Manager can export payroll data
- `CAN_VIEW_SALARY` - Employee can see their salary in reports

---

## 📁 Project Structure

```
time-reporting-system/
├── server/                          # Backend application
│   ├── src/
│   │   ├── app.ts                  # Express app setup
│   │   ├── server.ts               # Server entry point
│   │   ├── openapi.ts              # OpenAPI/Swagger config
│   │   ├── swagger.ts              # Swagger UI setup
│   │   ├── config/                 # Configuration management
│   │   ├── controllers/            # Route handlers
│   │   ├── middleware/             # Express middleware
│   │   ├── routes/                 # Route definitions
│   │   ├── services/               # Business logic
│   │   ├── cron/                   # Scheduled background tasks
│   │   ├── utils/                  # Utility functions (jwt, password)
│   │   └── database/
│   │       ├── connection.ts       # DB connection
│   │       ├── migrations/         # Knex migrations (22 files)
│   │       └── seeds/              # Seed files
│   ├── tests/
│   │   ├── unit/                   # Unit tests
│   │   └── integration/            # Integration tests (13 suites)
│   ├── knexfile.ts                 # Knex configuration
│   ├── package.json
│   └── tsconfig.json
├── frontend/                        # Frontend application (React/CRA)
├── docker-compose.yml              # Docker service definitions
├── docker-compose.test.yml         # Docker config for test environment
└── README.md                        # This file
```

## 🗄 Database Setup

### Database Schema

The application uses PostgreSQL with the following main tables:

**Users**

```sql
users (id, email, name, role, hourly_rate, is_active, created_at, updated_at)
```

**Projects & Tasks**

```sql
clients (id, name, contact_info, is_active, created_at, updated_at)
projects (id, client_id, name, budget, status, created_at, updated_at)
tasks (id, project_id, name, estimated_hours, status, created_at, updated_at)
```

**Time Tracking**

```sql
time_entries (id, user_id, project_id, task_id, date, hours, status, created_at, updated_at)
absences (id, user_id, type, start_date, end_date, status, deleted_at, created_at, updated_at)
active_timers (id, user_id, project_id, task_id, started_at)
weekly_submissions (id, user_id, year, week, status, submitted_at, reviewed_at)
attachments (id, absence_id, filename, original_name, mime_type, created_at)
user_task_assignments (id, user_id, task_id, created_at)
```

**Administration**

```sql
month_locks (id, year, month, is_locked, locked_at)
audit_logs (id, user_id, action, entity_type, entity_id, changes, created_at)
permission_flags (id, user_id, flag, created_at)
refresh_tokens (id, user_id, token_hash, expires_at, created_at)
notifications (id, user_id, type, message, is_read, created_at)
holiday_calendar (id, date, name, is_recurring, created_at)
system_settings (id, key, value, updated_at)
```

### Migrations

Run migrations:

```bash
npm run migrate
```

Check migration status:

```bash
npm run migrate:status
```

Rollback last migration:

```bash
npm run migrate:rollback
```

## ⚙️ Environment Configuration

### Required Environment Variables

| Variable             | Default                 | Description                                 |
| -------------------- | ----------------------- | ------------------------------------------- |
| `NODE_ENV`           | `development`           | Environment (development, test, production) |
| `PORT`               | `5000`                  | Server port                                 |
| `DB_HOST`            | `localhost`             | Database host                               |
| `DB_PORT`            | `5432`                  | Database port                               |
| `DB_NAME`            | `time_reporting`        | Database name                               |
| `DB_USER`            | `postgres`              | Database user                               |
| `DB_PASSWORD`        | -                       | Database password                           |
| `JWT_ACCESS_SECRET`  | -                       | JWT access token secret (min 32 chars)      |
| `JWT_REFRESH_SECRET` | -                       | JWT refresh token secret (min 32 chars)     |
| `CORS_ORIGIN`        | `http://localhost:5173` | Frontend URL for CORS                       |

### Optional Variables

| Variable                  | Default     | Description             |
| ------------------------- | ----------- | ----------------------- |
| `UPLOAD_DIR`              | `./uploads` | File upload directory   |
| `MAX_FILE_SIZE`           | `10485760`  | Max upload size (bytes) |
| `RATE_LIMIT_WINDOW_MS`    | `60000`     | Rate limit window (ms)  |
| `RATE_LIMIT_MAX_REQUESTS` | `100`       | Max requests per window |
| `LOG_LEVEL`               | `info`      | Logging level           |

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Docker-Based Testing

Run tests against a real PostgreSQL database in Docker:

```bash
npm run test:docker
```

Reset Docker test environment:

```bash
npm run test:docker:reset
```

### Test Coverage Goals

- Unit tests: Controllers, models, utilities
- Integration tests: API endpoints with real database
- Target: **80%+ coverage** for critical paths

### Writing Tests

**Unit Test Example:**

```typescript
// server/tests/unit/utils/jwt.test.ts
import { verifyAccessToken } from '../../../src/utils/jwt';

describe('JWT Verification', () => {
  it('should verify valid token', () => {
    const token = generateValidToken();
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('123');
  });

  it('should throw on expired token', () => {
    const expiredToken = generateExpiredToken();
    expect(() => verifyAccessToken(expiredToken)).toThrow();
  });
});
```

**Integration Test Example:**

```typescript
// server/tests/integration/time-entries.test.ts
describe('POST /api/time-entries', () => {
  it('should create time entry with valid data', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_id: 1,
        date: '2024-05-13',
        hours: 8,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});
```

---

## 🔐 Development Workflow

### Git Workflow

**Branch Naming:**

```
feature/add-new-feature
bugfix/fix-issue-description
hotfix/critical-fix
refactor/improve-component
docs/update-readme
```

**Commit Message Format:**

```
type(scope): description

[optional body]
[optional footer]

# Examples:
feat(auth): add JWT refresh token rotation
fix(time-entries): prevent duplicate entries on race condition
docs(readme): add API examples
refactor(models): extract shared query logic
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding/updating tests
- `chore` - Build, deps, CI config

**Commit Guidelines:**

1. Keep commits atomic (one logical change per commit)
2. Write descriptive messages
3. Reference issue numbers: `fixes #42`
4. Sign commits: `git commit -S` (if configured)

### Code Standards

**TypeScript:**

- Strict mode enabled (`strict: true`)
- No `any` types (use generics or union types)
- Interfaces for object shapes
- Type for primitive/union types

**Naming Conventions:**

- Classes & Interfaces: `PascalCase`
- Variables & functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts`

**ESLint & Prettier:**

```bash
cd server
npm run lint:fix   # Auto-fix issues
npm run format     # Format code
```

**Code Style:**

- Max line length: 120 characters
- Indentation: 2 spaces
- Semicolons: Required
- Trailing commas: ES5 style
- Quotes: Double quotes for strings

### PR Process

1. Create branch from `main`
2. Write tests first (TDD approach)
3. Implement feature/fix
4. Ensure all tests pass: `npm test`
5. Lint code: `npm run lint:fix`
6. Push to GitHub
7. Create Pull Request with description
8. Request review (2+ approvals required)
9. Merge to `main`
10. Delete feature branch

**PR Template:**

```markdown
## Description

Brief description of changes

## Motivation

Why these changes are needed

## Testing

How to test these changes

## Screenshots/Logs

If applicable, attach screenshots or logs

## Breaking Changes

Any breaking changes?

## Checklist

- [ ] Tests written and passing
- [ ] Code linted
- [ ] Documentation updated
- [ ] No console.logs left
```

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React)                       │
│  RTL Hebrew UI • Authentication • Time Entry Forms     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  EXPRESS SERVER                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Middleware Layer                         │ │
│  │  • Helmet (security)                              │ │
│  │  • CORS                                           │ │
│  │  • JWT Auth                                       │ │
│  │  • Rate Limiting                                  │ │
│  │  • Error Handling                                 │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Routes Layer                             │ │
│  │  /api/auth, /api/time-entries, /api/timer, ...   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │        Controllers → Services → Models            │ │
│  │  Business Logic • Data Validation • DB Queries   │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL/TCP
                       ↓
        ┌──────────────────────────────┐
        │   PostgreSQL Database        │
        │  • Users, Projects, Tasks    │
        │  • Time Entries, Absences    │
        │  • Audit Logs                │
        │  • Month Locks               │
        └──────────────────────────────┘
```

**Request Flow:**

```
Request → CORS → Helmet → Auth → Rate Limit → Route → Controller
         → Validate → Service → Model → Database
         ← Response ← Serialize ← Data ← Audit Log
```

---

## 🔒 Security Best Practices

### DO ✅

- **JWT Secrets**: Use minimum 32-char random strings
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Passwords**: Minimum 8 chars, mix of uppercase/lowercase/numbers/symbols
- **HTTPS**: Always use in production
- **CORS**: Restrict to known frontend URLs only
- **Helmet**: Security headers enabled by default
- **SQL Injection**: Using Knex parameterized queries (safe by default)
- **XSS**: Input sanitized, stored safely in database
- **CSRF**: Token validation on state-changing operations
- **Audit Logging**: All changes tracked and logged
- **Rate Limiting**: Prevents brute force attacks
- **Password Reset**: Tokens expire in 1 hour
- **Refresh Tokens**: Stored in HTTP-only secure cookies

### DON'T ❌

- **Don't hardcode secrets** in code or .env
- **Don't log sensitive data** (passwords, tokens, SSN)
- **Don't expose error details** to users in production
- **Don't trust user input** — validate everything
- **Don't disable HTTPS** in production
- **Don't use default credentials** in production
- **Don't commit .env files** to Git
- **Don't expose database** directly to frontend
- **Don't allow unlimited file uploads**
- **Don't disable rate limiting** on public endpoints

### Environment-Specific Secrets

```bash
# Development (.env)
JWT_ACCESS_SECRET=dev-secret-for-testing-min-32-chars-here
JWT_REFRESH_SECRET=dev-refresh-secret-for-testing-min-32-chars

# Production (set via deployment platform)
# AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, etc.
# NEVER hardcode in .env files
```

---

## 🔐 Authentication & Authorization

### User Roles

- **admin**: Full system access, user management, month locking
- **manager**: View reports, manage team absences
- **employee**: Create/edit own time entries and absence requests

### JWT Tokens

Access tokens expire in **15 minutes**. Refresh tokens are stored in secure HTTP-only cookies and last **7 days**.

**Example Login Flow:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Response:
# {
#   "accessToken": "eyJhbGc...",
#   "refreshToken": "eyJhbGc..."
# }
```

---

## 🚦 Rate Limiting Details

### Global Rate Limit

**Configuration:**

- Window: 60 seconds (60000 ms)
- Limit: 100 requests per window
- Applied to: All endpoints
- By: IP address

**Example:**

```
GET /api/time-entries    [1/100]
GET /api/time-entries    [2/100]
...
GET /api/time-entries    [100/100]
GET /api/time-entries    [429 TOO MANY REQUESTS] ← Rate limited
```

### Endpoint-Specific Limits

**Login Endpoint:**

- Window: 60 seconds
- Limit: 10 requests per window
- Purpose: Brute force protection

**Refresh Token Endpoint:**

- Window: 60 seconds
- Limit: 20 requests per window
- Purpose: Prevent token mill attacks

### Rate Limit Headers

All responses include:

```
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1684069200
```

### Handling Rate Limits

**When you hit a limit:**

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45
}
```

**Best Practice:**

- Implement exponential backoff on client
- Show user-friendly error message
- Log rate limit events for monitoring

---

## 📤 File Upload Specifications

### Absence Document Uploads

**Endpoint:** `POST /api/absences/:id/documents`

**Constraints:**

- Max file size: 10 MB
- Allowed formats: PDF, JPG, PNG, DOCX
- Max files per absence: 5

**Upload Example:**

```bash
curl -X POST http://localhost:5000/api/absences/1/documents \
  -H "Authorization: Bearer <token>" \
  -F "file=@medical_cert.pdf"

# Response: { "id": 1, "filename": "abc123-medical_cert.pdf", "url": "/uploads/abc123-..." }
```

**Storage:**

- Stored in: `server/uploads/` directory
- Filename: UUID + original extension (security)
- Served at: `GET /api/uploads/:filename` (auth required)

**Security:**

- Path traversal prevented (basename extraction)
- MIME type validation
- File extension whitelist
- No executable files allowed

---

## 📊 HTTP Status Codes & Error Handling

### Success Responses

| Code  | Meaning    | Use Case                         |
| ----- | ---------- | -------------------------------- |
| `200` | OK         | GET, PUT, DELETE (with response) |
| `201` | Created    | POST (creates resource)          |
| `204` | No Content | DELETE, PUT (no response body)   |

**Example:**

```json
// 200 OK
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe"
}

// 201 Created
{
  "id": 42,
  "project_id": 1,
  "hours": 8,
  "created_at": "2024-05-13T10:30:00Z"
}
```

### Client Errors (4xx)

| Code  | Meaning           | Common Causes                          |
| ----- | ----------------- | -------------------------------------- |
| `400` | Bad Request       | Invalid input, validation error        |
| `401` | Unauthorized      | Missing/invalid JWT token              |
| `403` | Forbidden         | Insufficient permissions, month locked |
| `404` | Not Found         | Resource doesn't exist                 |
| `409` | Conflict          | Duplicate email, quota exceeded        |
| `429` | Too Many Requests | Rate limit exceeded                    |

**Error Response Format:**

```json
{
  "message": "Validation failed",
  "errors": [
    { "field": "hours", "message": "must be positive number" },
    { "field": "date", "message": "cannot be in future" }
  ]
}
```

**Common Scenarios:**

```bash
# 400 - Invalid JSON
curl -X POST http://localhost:5000/api/time-entries \
  -H "Authorization: Bearer <token>" \
  -d "{ invalid json" # → 400 Bad Request

# 401 - Missing token
curl -X GET http://localhost:5000/api/time-entries
# Response: 401 Unauthorized { "message": "Authentication required" }

# 403 - Month locked
curl -X POST http://localhost:5000/api/time-entries \
  -H "Authorization: Bearer <token>" \
  -d '{"project_id": 1, "date": "2024-04-13", "hours": 8}'
# Response: 403 Forbidden { "message": "Month is locked" }

# 404 - Not found
curl -X GET http://localhost:5000/api/time-entries/999 \
  -H "Authorization: Bearer <token>"
# Response: 404 Not Found { "message": "Time entry not found" }

# 409 - Email exists
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"email": "existing@example.com", ...}'
# Response: 409 Conflict { "message": "Email already in use" }

# 429 - Rate limited
for i in {1..101}; do
  curl -X GET http://localhost:5000/api/time-entries
done
# Response: 429 Too Many Requests { "message": "Too many requests" }
```

### Server Errors (5xx)

| Code  | Meaning             | Action                              |
| ----- | ------------------- | ----------------------------------- |
| `500` | Internal Error      | Check server logs, file issue       |
| `503` | Service Unavailable | Database down, check infrastructure |

**Error Response:**

```json
{
  "message": "Internal server error",
  "requestId": "req-12345" // For debugging
}
```

### Error Handling Best Practices

**Client-Side:**

```javascript
const response = await fetch('/api/time-entries', { method: 'POST', ... });

if (response.ok) {
  const data = await response.json();
  // Success
} else if (response.status === 400) {
  const error = await response.json();
  console.error('Validation error:', error.errors);
} else if (response.status === 401) {
  // Token expired, redirect to login
} else if (response.status === 403) {
  // Show "This month is locked" message
} else if (response.status === 429) {
  // Show "Too many requests" and retry later
}
```

---

## ❓ FAQ

### Installation & Setup

**Q: Can I use MySQL instead of PostgreSQL?**
A: No, the project is built specifically for PostgreSQL. Using MySQL would require refactoring all migrations and queries.

**Q: How do I generate JWT secrets?**
A: Run this in terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generates a 64-char hex string (32 bytes).

**Q: Can I run the project without Docker?**
A: Yes! Just install PostgreSQL locally and configure .env with your database credentials.

**Q: What if I don't have Node 18?**
A: Install Node 18+ from [nodejs.org](https://nodejs.org). Use NVM (nvm-sh/nvm) to manage versions.

### Development

**Q: How do I add a new API endpoint?**
A:

1. Create route in `src/routes/` file
2. Create controller in `src/controllers/`
3. Add JSDoc with @openapi comment
4. Write tests in `tests/integration/`
5. Run `npm run build` to verify TypeScript

**Q: How do I create a new database migration?**
A:

```bash
npm run migrate:make add_new_column_to_users
# Edit the file in migrations/
npm run migrate
```

**Q: Tests are failing, what do I do?**
A:

```bash
npm run test -- --verbose              # See full output
npm run test:docker:reset             # Reset test database
npm run test:unit -- --testNamePattern="specific test"
```

**Q: How do I debug the server?**
A:

```bash
# VSCode launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### API & Authentication

**Q: Access token expired, what do I do?**
A: Use the refresh token to get a new one:

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Cookie: refreshToken=<your_refresh_token>"
```

**Q: How do I generate an access token for testing?**
A: Login first:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -d '{"email":"admin@example.com","password":"password"}'
```

Then use the `accessToken` in subsequent requests.

**Q: Can I manually edit tokens?**
A: No, tokens are cryptographically signed. Editing them makes them invalid.

**Q: How long do tokens last?**
A: Access tokens: 15 minutes. Refresh tokens: 7 days.

### Troubleshooting

**Q: Database migration failed, what now?**
A:

```bash
npm run migrate:status  # Check status
npm run migrate:rollback  # Revert last one
npm run migrate         # Try again
```

**Q: "Month is locked" error, how do I unlock?**
A: Admin only:

```bash
curl -X POST "http://localhost:5000/api/admin/months/2024/5/unlock" \
  -H "Authorization: Bearer <admin_token>"
```

**Q: Can't upload files, getting permission error?**
A: Ensure `server/uploads/` directory exists:

```bash
mkdir -p server/uploads
chmod 755 server/uploads
```

**Q: Server crashes when I start it?**
A:

```bash
npm run build              # Ensure TypeScript compiles
echo $NODE_ENV            # Check environment
cat .env                   # Verify .env is valid
```

---

## 📈 Monitoring & Logging

### Viewing Logs

**Development:**

```bash
cd server
npm run dev  # Logs in console
```

**Production:**

```bash
# View stdout
pm2 logs time-reporting-server

# View structured logs
tail -f /var/log/app/time-reporting.log
```

### Log Levels

| Level   | Severity | Usage                                  |
| ------- | -------- | -------------------------------------- |
| `debug` | Low      | Detailed info for debugging            |
| `info`  | Normal   | Important events (startup, requests)   |
| `warn`  | Medium   | Warnings (deprecated APIs, etc.)       |
| `error` | High     | Errors (failed queries, server errors) |

**Set log level:**

```bash
LOG_LEVEL=debug npm run dev
```

### Key Metrics to Monitor

**Server Health:**

- Response time (target: < 100ms)
- Error rate (target: < 0.1%)
- Uptime (target: 99.9%)

**Database:**

- Connection pool usage
- Query times
- Slow queries

**Application:**

- Active users
- API calls per minute
- Rate limit hits
- Authentication failures

### Health Check

```bash
curl http://localhost:5000/healthz
# Response: { "status": "ok", "timestamp": "2024-05-13T10:30:00Z" }
```

### Audit Log Monitoring

```bash
# Check for unusual activity
curl -X GET "http://localhost:5000/api/audit-logs?limit=100" \
  -H "Authorization: Bearer <admin_token>" | jq '.[] | select(.action=="DELETE")'
```

### Common Issues to Monitor

- High error rates → Check server logs
- Slow API responses → Check database performance
- High rate-limit hits → May indicate attack or misconfigured client
- Failed logins → May indicate brute force attempt
- Users in locked months → Alert them to wait for unlock

---

## 🚀 Deployment

### Using Docker

Build and run the entire stack:

```bash
docker-compose up --build
```

This starts:

- PostgreSQL database (port 5432)
- Backend server (port 5000)
- Frontend (port 5173 or built into backend)

### Environment Setup for Production

1. Update `.env` with production database credentials
2. Generate strong JWT secrets (min 32 characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Set `NODE_ENV=production`
4. Run migrations: `npm run migrate`
5. Build the app: `npm run build`
6. Start server: `npm start`

### Health Check

```bash
curl http://localhost:5000/healthz
# Response: { "status": "ok", "timestamp": "2024-05-13T10:30:00.000Z" }
```

## 🐛 Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

- Ensure PostgreSQL is running
- Check `DB_HOST`, `DB_PORT`, and credentials in `.env`
- If using Docker: `docker-compose up postgres`

### JWT Secret Error

```
Error: JWT secret is not set or too short
```

**Solution:**

- Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add to `.env`: `JWT_ACCESS_SECRET=<generated-secret>`

### Port Already in Use

```
Error: listen EADDRINUSE :::5000
```

**Solution:**

- Change PORT in `.env` or kill process on port 5000
- On Windows: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`

### Migration Failed

```
Error: Migration not found
```

**Solution:**

```bash
npm run migrate:status
npm run migrate:rollback
npm run migrate
```

## 📞 Support & Contact

For issues, bug reports, or feature requests:

1. Check existing documentation in `/docs`
2. Review API documentation at `/api/docs` (after starting server)
3. Check test files for usage examples
4. Open an issue on GitHub

## 📄 License

This project is proprietary and confidential.

---

**Last Updated**: May 2026
**Version**: 1.0.0
