# Nuxt Base Stack

โครงสร้างพื้นฐานสำหรับพัฒนา Web Application ด้วย Nuxt 4 พร้อม Docker, Database, และ Authentication

## คุณสมบัติหลัก

- ⚡ **Nuxt 4** + **Vue 3** + **Nuxt UI** - Modern frontend framework
- 🐳 **Docker Ready** - พร้อมใช้งานกับ Docker Compose (MariaDB + Redis + App + Nginx)
- 🗄️ **MariaDB/MySQL** - Database ด้วย Drizzle ORM
- 🔐 **Authentication** - รองรับ Local Auth และ ThaiID (กรมการปกครอง)
- 👥 **User Management** - จัดการผู้ใช้งานแบบครบวงจร
- 🛡️ **RBAC** - Role Based Access Control (superadmin, admin, user)
- 🌐 **ภาษาไทย** - รองรับภาษาไทยอย่างเต็มรูปแบบ
- 🚀 **Production Ready** - พร้อม deploy พร้อม Health Check, Rate Limiting

## เทคโนโลยีที่ใช้

- **Frontend**: Nuxt 4 + Vue 3 + Nuxt UI
- **Backend**: Nuxt Server (Nitro)
- **Database**: MariaDB/MySQL + Drizzle ORM
- **Cache**: Redis
- **Authentication**: JWT + ThaiID OAuth
- **Styling**: Tailwind CSS
- **Container**: Docker + Docker Compose

## การติดตั้ง

### Local Development

```bash
# 1. Clone repository
git clone <your-repo-url>
cd nuxt-base-stack

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your configuration
nano .env

# 5. Push database schema
npm run db:push

# 6. Seed database (create admin user)
npm run db:seed

# 7. Start development server
npm run dev
```

### Docker Deployment

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your configuration
nano .env

# 3. Run deployment script
chmod +x deploy.sh
./deploy.sh

# หรือ manual
docker-compose up -d --build

# 4. Seed database
docker-compose exec -T app npm run db:seed
```

ดู [DOCKER.md](./DOCKER.md) สำหรับรายละเอียดเพิ่มเติมเกี่ยวกับ Docker deployment

## บัญชีผู้ใช้เริ่มต้น

หลังจาก run seed จะมีบัญชี admin ดังนี้:

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **สำคัญ**: ควรเปลี่ยนรหัสผ่านหลังจากการติดตั้งครั้งแรก!

## โครงสร้างโปรเจกต์

```
nuxt-base-stack/
├── pages/              # Vue Pages
│   ├── index.vue      # Dashboard / Landing Page
│   └── login.vue      # Login Page
├── server/
│   ├── api/           # API Endpoints
│   │   ├── auth/      # Authentication APIs
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   ├── me.get.ts
│   │   │   └── thaid/ # ThaiID OAuth
│   │   ├── health.get.ts # Health check endpoint
│   │   └── admin/     # Admin APIs
│   │       ├── users/
│   │       └── roles.get.ts
│   ├── database/      # Database Schema & Config
│   │   └── schema.ts  # Drizzle schema (users, roles, agencies)
│   ├── utils/         # Utility Functions
│   │   ├── auth.ts    # JWT & Auth utilities
│   │   ├── db.ts      # Database connection
│   │   └── thaid.ts   # ThaiID integration
│   └── scripts/       # Database Scripts
│       └── seed.ts    # Seed data
├── composables/       # Vue Composables
│   └── auth.ts        # useUser() composable
├── Dockerfile         # Multi-stage Docker build
├── docker-compose.yml # Docker stack definition
├── nginx.conf         # Nginx reverse proxy config
├── deploy.sh          # Deployment script
└── DOCKER.md          # Docker deployment guide
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username/password |
| GET | `/api/auth/thaid/login` | Login with ThaiID |
| GET | `/api/auth/thaid/callback` | ThaiID OAuth callback |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user info |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create new user |
| PATCH | `/api/admin/users/[id]` | Update user |
| DELETE | `/api/admin/users/[id]` | Delete user |
| GET | `/api/admin/roles` | List all roles |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

## Environment Variables

ดูรายละเอียดใน [`.env.example`](./.env.example)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | - |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `THAID_CLIENT_ID` | ThaiID Client ID | - |
| `THAID_CLIENT_SECRET` | ThaiID Client Secret | - |
| `THAID_REDIRECT_URI` | ThaiID Callback URL | - |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REDIS_PASSWORD` | Redis password | - |

## การใช้งานเป็น Base Project

ในการเริ่ม project ใหม่จาก base stack นี้:

```bash
# 1. Clone this repo
git clone <your-base-repo-url> my-new-project
cd my-new-project

# 2. เปลี่ยน project name
# แก้ package.json -> "name"
# แก้ README.md, .env.example ตามต้องการ

# 3. Remove .git และ init repo ใหม่
rm -rf .git
git init

# 4. เพิ่ม features เฉพาะของ project
# - เพิ่ม pages ใหม่
# - เพิ่ม API endpoints
# - แก้ไข database schema
# - Customize UI/UX

# 5. Commit และ push ไปยัง repo ใหม่
git add .
git commit -m "Initial commit from nuxt-base-stack"
git remote add origin <your-new-repo-url>
git push -u origin main
```

## Scripts ที่มี

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed database with initial data |

## การปรับแต่ง

### เพิ่ม Tables ใหม่

แก้ไข `server/database/schema.ts`:

```typescript
export const newTable = mysqlTable('new_table', {
  id: int('id').autoincrement().primaryKey(),
  // เพิ่ม fields ตามต้องการ
});
```

แล้ว run:

```bash
npm run db:push
```

### เพิ่ม API Endpoint

สร้างไฟล์ใน `server/api/`:

```typescript
// server/api/example.get.ts
export default defineEventHandler(async (event) => {
  return { message: 'Hello World' };
});
```

### เพิ่ม Page ใหม่

สร้างไฟล์ใน `pages/`:

```vue
<!-- pages/about.vue -->
<template>
  <div>About Page</div>
</template>
```

## License

MIT

## ผู้สนับสนุน

Built with ❤️ using Nuxt 4
