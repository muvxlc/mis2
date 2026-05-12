import { defineConfig } from 'drizzle-kit';

// Parse DATABASE_URL if available, otherwise use individual env vars
function getDbCredentials() {
  if (process.env.DATABASE_URL) {
    // Parse mysql://user:password@host:port/database
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ''),
      port: Number(url.port) || 3306,
    };
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'mis_db',
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
  };
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: getDbCredentials(),
});
