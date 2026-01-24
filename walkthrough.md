# Backend Setup Walkthrough

I have set up a professional Node.js Express server with PostgreSQL, following Clean Architecture principles.

## Features Implemented
- **Database**: PostgreSQL with strict schema, constraints, and migrations.
- **Architecture**: `Controller` -> `Service` -> `Repository` pattern.
- **Auth**: JWT-based authentication (Login, Middleware).
- **Security**: Password hashing with Bcrypt + Pepper.
- **Modules**:
    - **Organizations**: Create, Suspend/Activate.
    - **Users**: Create, Role-based checks.
    - **Projects**: Create, List, managed by Org.
    - **Tasks**: Create, Workflow (Status transitions with history), Audit Logs.

## How to Run

1. **Install Dependencies**:
    ```bash
    npm install
    ```

2. **Database Setup**:
    - Ensure PostgreSQL is running locally (`localhost:5432`).
    - Update your `.env` with correct credentials (including `PEPPER`).
    - Run Migrations:
        ```bash
        npm run migrate:up
        ```

3. **Start Server**:
    ```bash
    npm run dev
    ```

4. **Verify/Seed Data**:
    - I created a seed script to populate initial data:
        ```bash
        node src/scripts/seed.js
        ```
    - This will create:
        - Organization: "Jetzy"
        - User: `admin@jetzy.com` / `password123`
        - Project: "Project 1"

## API Endpoints (Quick Reference)
- `POST /api/v1/auth/login` - Get Token
- `POST /api/v1/organizations` - Create Org
- `POST /api/v1/users` - Create User
- `POST /api/v1/projects` - Create Project (Auth required)
- `GET /api/v1/projects` - List Projects (Auth required)
- `POST /api/v1/tasks` - Create Task (Auth required)
- `PATCH /api/v1/tasks/:id/status` - Update Status (Auth required)
