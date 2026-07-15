#!/bin/bash

# MIS Docker Deployment Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Check if .env exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    print_success "Created .env file. Please edit it with your configuration."
    print_info "Edit .env file and run this script again."
    exit 1
fi

if grep -Eq '^((MYSQL_ROOT_PASSWORD|MYSQL_PASSWORD|REDIS_PASSWORD|JWT_SECRET|ADMIN_PASSWORD)=replace-with-|MYSQL_ROOT_PASSWORD=rootpassword$|MYSQL_PASSWORD=mis_password$|REDIS_PASSWORD=redispassword$|JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars$)' .env; then
    print_error "Replace all placeholder or legacy default secrets in .env before deployment."
    exit 1
fi

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose down

# Build and start services
print_info "Building and starting services..."
docker-compose up -d --build mariadb redis app

# Wait for services to be healthy
print_info "Waiting for services to be ready..."
sleep 10

# Check service health
print_info "Checking service health..."

# Check MariaDB
if docker-compose ps mariadb | grep -q "Up (healthy)"; then
    print_success "MariaDB is healthy"
else
    print_error "MariaDB is not healthy"
    docker-compose logs mariadb
fi

# Check Redis
if docker-compose ps redis | grep -q "Up (healthy)"; then
    print_success "Redis is healthy"
else
    print_error "Redis is not healthy"
    docker-compose logs redis
fi

# Check App
if docker-compose ps app | grep -q "Up (healthy)"; then
    print_success "App is healthy"
else
    print_error "App is not healthy"
    docker-compose logs app
fi

# Show logs
print_info "Showing recent logs..."
docker-compose logs --tail=20 app

# Show status
print_success "Deployment completed!"
echo ""
docker-compose ps

print_info "Application is running at: http://localhost:${APP_PORT:-3000}"
print_info "Initial username: admin (password is read from ADMIN_PASSWORD during first setup)"
