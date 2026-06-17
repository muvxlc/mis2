import { db } from './server/utils/db';
import { externalDatabases } from './server/database/schema';
import { getExternalDb } from './server/utils/externalDb';
import { sql, eq } from 'drizzle-orm';

async function main() {
  const [config] = await db.select()
    .from(externalDatabases)
    .where(eq(externalDatabases.isActive, 1))
    .limit(1);

  if (!config) {
    console.error('No HOSxP DB config found');
    process.exit(1);
  }

  const extDb = await getExternalDb({
    id: config.id,
    type: config.type as 'mysql' | 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database
  });

  // Check unique depcode in ovst_service_time
  console.log('--- Unique depcodes in ovst_service_time ---');
  try {
    const [deps]: any[] = await extDb.execute(sql`
      SELECT depcode, COUNT(*) as cnt 
      FROM ovst_service_time 
      GROUP BY depcode
      ORDER BY cnt DESC
      LIMIT 10
    `);
    console.log(deps);
  } catch (err) {
    console.error(err);
  }

  // Check if there are records where depcode = '042'
  console.log('\n--- Checking depcode = 042 ---');
  try {
    const [res]: any[] = await extDb.execute(sql`
      SELECT * FROM ovst_service_time 
      WHERE depcode = '042' 
      LIMIT 5
    `);
    console.log(res);
  } catch (err) {
    console.error(err);
  }

  // Let's also check if there is an ovst_doctor_sign record for depcode = '042'
  console.log('\n--- Checking doctor signs for depcode = 042 ---');
  try {
    const [resSigns]: any[] = await extDb.execute(sql`
      SELECT ds.*, k.department 
      FROM ovst_doctor_sign ds
      LEFT JOIN kskdepartment k ON ds.depcode = k.depcode
      WHERE ds.depcode = '042' 
      LIMIT 5
    `);
    console.log(resSigns);
  } catch (err) {
    console.error(err);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
