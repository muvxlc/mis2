export default defineEventHandler(async (event) => {
  try {
    // Check database connection
    const db = await import('../../server/utils/db').then(m => m.db);
    await db.execute('SELECT 1');

    // Check Redis connection (optional)
    let redisStatus = 'not configured';
    if (process.env.REDIS_HOST) {
      redisStatus = 'configured';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisStatus
      },
      version: '1.0.0'
    };
  } catch (error: any) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service unhealthy',
      data: {
        error: error.message
      }
    });
  }
});
