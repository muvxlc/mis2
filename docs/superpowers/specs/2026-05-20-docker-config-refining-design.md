# Design Document: Refining Docker Configuration & Security

**Date:** 2026-05-20
**Topic:** Docker Config Refining & Security Enhancement

## 1. Overview
Optimize the Docker Compose setup by configuring Redis memory limits, removing redundant Nginx proxy configuration, and enhancing overall system security and stability based on log analysis.

## 2. Changes

### 2.1 Redis Optimization & Security
- **Goal:** Prevent Redis from consuming all system memory and ensure data eviction.
- **Configuration:**
    - Set `maxmemory` to `256mb`.
    - Set `maxmemory-policy` to `allkeys-lru`.
- **Implementation:** Update the `command` section of the `redis` service in `docker-compose.yml`.

### 2.2 MariaDB Stability
- **Goal:** Address `io_uring` warnings and improve connection stability.
- **Implementation:** 
    - Remove obsolete `version` tag from `docker-compose.yml`.
    - Keep `ports` as `3306:3306` per user request for easy Navicat access.

### 2.3 Nginx Removal
- **Goal:** Align with existing infrastructure where Nginx Proxy Manager is managed externally.
- **Implementation:** Remove the `nginx` service and the `with-nginx` profile from `docker-compose.yml`.

### 2.4 Application Security
- **Goal:** Prevent insecure defaults for JWT.
- **Implementation:** 
    - Modify `server/utils/auth.ts` to throw an error if `JWT_SECRET` is missing instead of using a default.
    - Set `.env` file permissions to `600` for host-level security.

## 3. Impact & Verification
- **Redis:** Check memory usage using `docker exec mis-redis redis-cli -a <password> info memory`.
- **Security:** Verify the application fails to start if `JWT_SECRET` is unset.
- **Connectivity:** Ensure Navicat can still connect to port `3306`.
