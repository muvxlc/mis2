# mis2 Project Instructions

## Tech Stack
- **Framework:** Nuxt 4 (Vue 3, TypeScript)
- **Database ORM:** Drizzle ORM
- **Database Engine:** MariaDB 11.4 (via Docker)
- **Cache:** Redis 7 (via Docker)
- **Styling:** @nuxt/ui v4 (Tailwind CSS)
- **Authentication:** Custom JWT with bcryptjs, ThaiID OAuth integration

## Project Structure
- `composables/`: Shared Vue composables (e.g., auth logic).
- `config/`: Project configuration (e.g., MCPorter).
- `drizzle/`: Database migrations and metadata.
- `middleware/`: Nuxt route middleware (e.g., global auth guard).
- `pages/`: Application views and routing.
- `public/`: Static assets and user uploads.
- `server/`: Nitro server-side logic.
    - `api/`: API endpoints (Health, Admin, Auth, ThaiID).
    - `database/`: Database schema and connection logic.
    - `scripts/`: Utility scripts (e.g., database seeding).
    - `utils/`: Server-side helper functions (Auth, DB, Notifications, ThaiID).

## Development
- Uses Docker Compose for local environment (MariaDB, Redis, App).
- Drizzle Kit for database management (`db:generate`, `db:push`).
- Custom seed script available (`db:seed`).
