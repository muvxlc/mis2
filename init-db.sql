-- Create database if not exists
CREATE DATABASE IF NOT EXISTS mis_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mis_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON mis_db.* TO 'mis_user'@'%';
FLUSH PRIVILEGES;
