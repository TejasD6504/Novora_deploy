// run-migrations.js - execute create_tables.sql against MySQL using env vars
const fs = require('fs');
const mysql = require('mysql2/promise');

const SQL_FILE = 'create_tables.sql';

async function run() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || '';

  console.log('Using MySQL host=%s user=%s', host, user);

  let sql;
  try {
    sql = fs.readFileSync(SQL_FILE, 'utf8');
  } catch (err) {
    console.error('Could not read', SQL_FILE, err.message);
    process.exit(1);
  }

  try {
    const conn = await mysql.createConnection({ host, user, password, multipleStatements: true });
    console.log('Connected to MySQL — running migrations...');
    await conn.query(sql);
    console.log('Migrations applied (create_tables.sql executed).');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
