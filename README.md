# Beats LMS v2

## Project Structure

```
beats-lms-v2/
├── apps/
│   ├── server/           # @lms/server - Express.js backend
│   └── web/              # @lms/web - React/Vite frontend
├── packages/
│   ├── db/               # @db - Prisma schema, migrations, seed
│   └── types/            # Shared types (optional)
├── package.json          # Root package.json with workspace config
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

## Environment Variables

Create a `.env` file in the `packages/db` directory with:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beats_lms_v2
```

Create a `.env` file in the `apps/server` directory with:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beats_lms_v2
JWT_SECRET=your-super-secret-jwt-key-here
PORT=4000
```

## Setup and Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate Prisma client:
   ```bash
   pnpm --filter @db generate
   ```

3. Run database migrations:
   ```bash
   pnpm --filter @db migrate:dev
   ```

4. Seed the database:
   ```bash
   pnpm --filter @db seed
   ```

### Quick demo reset (dev)

Ensure Postgres is running (e.g., `docker compose -f docker-compose.dev.yml up -d`), then run:

```bash
pnpm demo:reset
```

Add `-- --seed-only` to just reset + seed without starting servers. Demo credentials print in the terminal after seeding.

## Running the Applications

### Backend Server
```bash
pnpm --filter @lms/server dev
```

### Frontend Application
```bash
pnpm --filter @lms/web dev
```

## Login Credentials

- **Username**: SA001
- **Password**: Test@12345
- **Role**: SUPERADMIN

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Superadmin Routes
- `GET /superadmin/abacus/courses` - Get all abacus courses with modules
- `GET /superadmin/abacus-levels` - Get all abacus levels
- `POST /superadmin/abacus-levels` - Create a new abacus level
- `PUT /superadmin/abacus-levels/:id` - Update an abacus level
- `DELETE /superadmin/abacus-levels/:id` - Delete an abacus level
- `GET /superadmin/abacus-levels/:levelId/worksheets` - Get all worksheets for a level
- `POST /superadmin/worksheets` - Create a new worksheet
- `PUT /superadmin/worksheets/:id` - Update a worksheet
- `DELETE /superadmin/worksheets/:id` - Delete a worksheet

## Database Schema

The database includes the following tables:

1. **User** - Stores user information including SUPERADMIN
2. **AbacusCourse** - Represents abacus courses
3. **AbacusModule** - Modules within abacus courses
4. **AbacusLevel** - Individual levels within the curriculum
5. **AbacusWorksheet** - Worksheets for practice and assessment

## Abacus Phase 2 – Curriculum Structure

### Course Structure
The system now supports a hierarchical curriculum structure:
- **Course** (e.g., ABACUS_L1_REGULAR) - Top-level course with multiple variants
- **Module** (9 modules for ABACUS_L1_REGULAR) - Logical grouping of levels
- **Level** - Individual learning units with specific learning objectives
- **Worksheet** - Practice and assessment materials for each level

### ABACUS_L1_REGULAR Modules
1. Holding practice
2. Addition 1-digit
3. Subtraction 1-digit
4. 2-digit operations
5. Mixed 2-digit
6. Carry / Borrow basics
7. 3-digit operations
8. Speed enhancement
9. Exam revision

Each module contains 2-4 levels with increasing difficulty, covering specific learning objectives.

### Level Properties
Each level includes detailed configuration:
- **Name**: Human-readable descriptive name
- **Difficulty**: EASY/MEDIUM/HARD classification
- **Age Group**: Target age range (e.g., "6-9")
- **Operations**: Mathematical operations covered (ADDITION, SUBTRACTION, etc.)
- **Formulas**: Specific techniques taught (5-combo, complement, etc.)
- **Max Digits/Terms**: Complexity constraints
- **Exam Settings**: Duration and passing criteria
- **Time Bonus**: Optional time-based scoring

### Worksheet Types
Worksheets provide structured practice and assessment:
- **PRACTICE**: Basic skill reinforcement
- **SPEED**: Timed calculation drills
- **EXAM**: Formal assessment sheets
- **HOMEWORK**: Take-home assignments
- **AURALS**: Mental calculation exercises

Each worksheet can be configured with difficulty bands and question counts.
