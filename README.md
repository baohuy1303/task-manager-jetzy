# Task Manager Backend

A professional, scalable, and secure multi-tenant backend system for managing projects and workflows, built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)

### 2. Configuration
Create a `.env` file in the root directory (use `.env.example` as a template):
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=task_manager
DATABASE_URL=postgres://your_user:your_password@localhost:5432/task_manager
JWT_SECRET=your_jwt_secret
PEPPER=your_pepper_string
```

### 3. Setup
```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate:up

# Seed initial data (Org, Admin, Project)
node src/scripts/seed.js

# Start development server
npm run dev
```

## 🏗 Architecture
This project follows **Clean Architecture** principles:
- **Routes**: API endpoints definition.
- **Controllers**: Request validation and response orchestration.
- **Services**: Pure business logic (Workflows, Permissions).
- **Repositories**: Data access layer (PostgreSQL).
- **Middlewares**: Authentication (JWT), Error Handling, Security (Helmet).

## 🔒 Security
- **Bcrypt + Pepper**: Secure password hashing.
- **JWT**: Token-based authentication.
- **RBAC**: Role-Based Access Control (Admin, Manager, Member).
- **Audit Logging**: Every sensitive action is logged to the `audit_logs` table.

## 📝 API Reference
See [walkthrough.md](./walkthrough.md) for a detailed list of implemented endpoints and workflow rules.
