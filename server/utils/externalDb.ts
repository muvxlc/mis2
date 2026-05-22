import { drizzle as mysqlDrizzle } from 'drizzle-orm/mysql2';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import mysql from 'mysql2/promise';
import pg from 'pg';

type DBType = 'mysql' | 'postgres';

interface DBConfig {
  id: number;
  type: DBType;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// Caches for pools and drizzle instances
const mysqlPools = new Map<number, mysql.Pool>();
const pgPools = new Map<number, pg.Pool>();

/**
 * Creates or retrieves a cached database connection for an external source
 */
export async function getExternalDb(config: DBConfig) {
  if (config.type === 'mysql') {
    let pool = mysqlPools.get(config.id);
    
    if (!pool) {
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
      mysqlPools.set(config.id, pool);
    }
    
    return mysqlDrizzle(pool);
  } else if (config.type === 'postgres') {
    let pool = pgPools.get(config.id);
    
    if (!pool) {
      pool = new pg.Pool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        max: 5,
      });
      pgPools.set(config.id, pool);
    }
    
    return pgDrizzle(pool);
  }
  
  throw new Error(`Unsupported database type: ${config.type}`);
}

export async function testExternalConnection(config: DBConfig) {
  if (config.type === 'mysql') {
    const connection = await mysql.createConnection({
      host: config.host.trim(),
      port: config.port,
      user: config.username.trim(),
      password: config.password,
      database: config.database.trim(),
      connectTimeout: 10000,
      ssl: false // Disable SSL to avoid access denied due to cert issues
    });
    await connection.ping();
    await connection.end();
    return true;
  } else if (config.type === 'postgres') {
    const client = new pg.Client({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  }
  
  throw new Error(`Unsupported database type: ${config.type}`);
}

/**
 * Closes and removes a cached pool (e.g. when config is updated or deleted)
 */
export async function closeExternalPool(id: number, type: DBType) {
  if (type === 'mysql') {
    const pool = mysqlPools.get(id);
    if (pool) {
      await pool.end();
      mysqlPools.delete(id);
    }
  } else if (type === 'postgres') {
    const pool = pgPools.get(id);
    if (pool) {
      await pool.end();
      pgPools.delete(id);
    }
  }
}
