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

# Load environment variables
print_info "Loading environment variables..."
export $(cat .env | grep -v '^#' | xargs)

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose down

# Build and start services
print_info "Building and starting services..."
docker-compose up -d --build

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

# Run database migrations/seed
print_info "Running database seed..."
docker-compose exec -T app npx tsx server/scripts/seed.ts || print_warning "Seed failed or already seeded"

# Show logs
print_info "Showing recent logs..."
docker-compose logs --tail=20 app

# Show status
print_success "Deployment completed!"
echo ""
docker-compose ps

print_info "Application is running at: http://localhost:${APP_PORT:-3000}"
print_info "Default credentials: admin / admin123"
