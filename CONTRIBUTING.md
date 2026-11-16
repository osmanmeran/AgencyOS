# Contributing to Marvelops TravelPro

Thank you for your interest in contributing to Marvelops TravelPro! We welcome contributions, bug fixes, documentation improvements, and feature proposals.

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

---

## Code of Conduct

Please be respectful, constructive, and inclusive in all interactions, issues, and discussions.

---

## Development Setup

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **SQLite3**: bundled via `better-sqlite3` (C++ compiler tools for your OS like `build-essential` on Linux or Xcode Command Line Tools on macOS may be needed for native compilation)

### Getting Started

1. **Fork and Clone the Repository**:

   ```bash
   git clone https://github.com/<your-username>/marvelops.git
   cd marvelops
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**:

   ```bash
   cp .env.example .env
   ```

   _For local development, the default `.env.example` values work out-of-the-box._

4. **Start the Development Servers**:
   Run both frontend and backend concurrently:
   ```bash
   # Terminal 1: Frontend (Vite on :5173)
   npm run dev

   # Terminal 2: Backend (Express on :3001)
   npm run server
   ```
   Access the web app at `http://localhost:5173`. Use `/mock-login` for local development.

---

## Quality Checks & Verification

Before submitting a Pull Request, make sure your code passes all lint, typecheck, build, and test steps:

```bash
# 1. Typecheck (TypeScript via jsconfig.json)
npm run typecheck

# 2. Linting (ESLint)
npm run lint

# 3. Unit & Integration Tests (Vitest)
npm test

# 4. Production Build (Vite)
npm run build
```

---

## Architectural Guidelines

When submitting code changes, please keep these core design principles in mind:

1. **Multi-Tenancy**:
   - Each workspace uses an isolated SQLite file (`data/tenants/<id>/marvelops.db`).
   - Tenant resolution happens in `tenantMiddleware` via `runWithTenant()` using `AsyncLocalStorage`. Never bypass or mix tenant scopes.
2. **Entity System**:
   - Adding a new entity type requires registering it in `ENTITIES` in `server/db.js` and configuring read/write permissions in `server/services/entities.js`.
3. **Permissions Parity**:
   - Permission definitions live in `shared/permissions.js`.
   - Any permission changes must maintain parity between `server/permissions.js` and `src/lib/permissions.js` (enforced by `tests/lib/parity.test.js`).
4. **Internationalization (i18n)**:
   - User-facing text must be wrapped with `useT()` and key definitions added to `src/lib/i18n/locales/` (`en.json` is the fallback dictionary).
5. **Security & Sanitization**:
   - All database queries must use parameterized SQL.
   - User-generated inputs must be sanitized before storage or rendering in emails.

---

## Submitting Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit with descriptive messages:
   ```bash
   git commit -m "Add descriptive summary of changes"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against the `main` branch. Provide a clear description of the problem solved, testing steps, and relevant screenshots if UI changes were made.
