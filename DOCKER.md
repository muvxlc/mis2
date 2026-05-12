# Docker Deployment Guide

วิธีการ deploy MIS ด้วย Docker และ Docker Compose

## สิ่งที่ต้องมี

- Docker (version 20.10+)
- Docker Compose (version 2.0+)

## การติดตั้ง

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd mis
```

### 2. ตั้งค่า Environment Variables

```bash
# คัดลอกไฟล์ .env.example เป็น .env
cp .env.example .env

# แก้ไขค่าตั้งค่าใน .env ตามต้องการ
nano .env  # หรือใช้ text editor อื่น
```

### 3. สร้าง Docker Containers และ Start Services

**วิธีง่าย (ใช้ script):**

```bash
./deploy.sh
```

**วิธี manual:**

```bash
# Build และ start services
docker-compose up -d --build

# ดู logs
docker-compose logs -f

# ตรวจสอบสถานะ services
docker-compose ps
```

### 4. Seeding Database

```bash
# Seed ข้อมูลเริ่มต้น (admin user)
docker-compose exec -T app npx tsx server/scripts/seed.ts
```

## การใช้งาน

หลังจาก deployment สำเร็จ:

- **App URL**: http://localhost:3000
- **Default Admin**:
  - Username: `admin`
  - Password: `admin123`

⚠️ **สำคัญ**: ควรเปลี่ยนรหัสผ่าน admin หลังจาก login ครั้งแรก

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Nuxt Application |
| mariadb | 3306 | MySQL/MariaDB Database |
| redis | 6379 | Redis Cache |
| nginx | 80, 443 | Reverse Proxy (optional) |

## คำสั่ง Docker Compose ที่มีประโยชน์

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop และลบ volumes (ข้อมูลจะหาย!)
docker-compose down -v

# View logs
docker-compose logs -f [service_name]
docker-compose logs -f app
docker-compose logs -f mariadb
docker-compose logs -f redis

# Execute command in container
docker-compose exec app sh
docker-compose exec mariadb mysql -u mis_user -p

# Rebuild service
docker-compose up -d --build app

# Scale services (หากต้องการหลาย instance)
docker-compose up -d --scale app=2
```

## การเชื่อมต่อ Database จากภายนอก

หากต้องการเชื่อมต่อ database จากเครื่อง local:

```bash
# เชื่อมต่อด้วย MySQL Client
mysql -h 127.0.0.1 -P 3306 -u mis_user -p

# ใช้ DBeaver, MySQL Workbench, หรือ GUI อื่นๆ
# Host: localhost
# Port: 3306
# User: mis_user
# Password: (ดูใน .env)
# Database: mis_db
```

## การ Backup และ Restore

### Backup Database

```bash
# Backup ทั้ง database
docker-compose exec mariadb mariadb-dump -u root -p${MYSQL_ROOT_PASSWORD} mis_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup เฉพาะ tables ที่ต้องการ
docker-compose exec mariadb mariadb-dump -u root -p${MYSQL_ROOT_PASSWORD} mis_db users roles agencies > backup_users.sql
```

### Restore Database

```bash
# Restore จาก backup
docker-compose exec -T mariadb mariadb -u root -p${MYSQL_ROOT_PASSWORD} mis_db < backup_20250112_140000.sql
```

### Backup Volumes

```bash
# Backup ทั้ง volumes
docker run --rm -v mis_mariadb_data:/data -v $(pwd):/backup alpine tar czf /backup/mariadb_data_$(date +%Y%m%d).tar.gz /data

# Backup Redis
docker run --rm -v mis_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_data_$(date +%Y%m%d).tar.gz /data
```

## การ Update Application

```bash
# Pull latest code
git pull

# Rebuild และ restart
docker-compose up -d --build

# หรือใช้ deploy script
./deploy.sh
```

## การ Debug

### ดู logs ของแต่ละ service

```bash
# ดู logs ทั้งหมด
docker-compose logs

# ดู logs เฉพาะ app
docker-compose logs -f app

# ดู logs 100 บรรทัดล่าสุด
docker-compose logs --tail=100 app
```

### เข้าไปใน container เพื่อ debug

```bash
# เข้า app container
docker-compose exec app sh

# เข้า mariadb container
docker-compose exec mariadb bash

# เข้า redis container
docker-compose exec redis redis-cli -a ${REDIS_PASSWORD}
```

### Health Check

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Check service status
docker-compose ps
```

## การใช้งาน Nginx (Optional)

หากต้องการใช้ Nginx เป็น reverse proxy:

```bash
# Start พร้อม nginx
docker-compose --profile with-nginx up -d --build
```

### ตั้งค่า SSL/HTTPS

1. สร้างโฟลเดอร์ `nginx-ssl`
2. วาง SSL certificates:
   - `nginx-ssl/fullchain.pem`
   - `nginx-ssl/privkey.pem`
3. แก้ไข `nginx.conf` และ uncomment HTTPS section
4. Restart services:

```bash
docker-compose --profile with-nginx up -d --build
```

## Troubleshooting

### Port already in use

```bash
# แก้ไข port ใน .env
APP_PORT=3001
MYSQL_PORT=3307
REDIS_PORT=6380
```

### Database connection failed

```bash
# ตรวจสอบว่า mariadb พร้อมแล้ว
docker-compose ps mariadb

# รอสักครู่ แล้ว restart app
docker-compose restart app
```

### Permission denied on deploy.sh

```bash
chmod +x deploy.sh
```

### Container ไม่ start

```bash
# ดู logs เพื่อหาสาเหตุ
docker-compose logs app

# ลบและสร้างใหม่ (ข้อมูลจะหาย!)
docker-compose down -v
docker-compose up -d --build
```

## Production Deployment Tips

1. **เปลี่ยนค่าใน .env**:
   - ใช้ JWT_SECRET ที่แข็งแรง (32+ characters)
   - เปลี่ยนรหัสผ่าน database
   - ใช้ REDIS_PASSWORD ที่ปลอดภัย

2. **ใช้ Nginx**:
   - เปิดใช้ HTTPS
   - ตั้งค่า security headers
   - เปิดใช้ rate limiting

3. **Monitoring**:
   - เก็บ logs (docker-compose logs หรือใช้ log aggregator)
   - ตั้งค่า alerts
   - monitoring resources

4. **Backup**:
   - Set up automated backups
   - Test restore procedure
   - Keep backups off-site

5. **Updates**:
   - เก็บ dependencies อัปเดต
   - Test ใน staging ก่อน production
   - Use rolling updates

## License

MIT
