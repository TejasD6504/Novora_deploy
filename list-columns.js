// list-columns.js - list columns for specific tables in Postgres using the unified db layer
const db = require('./db');

const tables = ['product','rack','robot','task','storagelocation','signup','users'];

async function run() {
  try {
    for (const t of tables) {
      try {
        const rows = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [t]);
        console.log(`\nTable: ${t}`);
        if (!rows || rows.length === 0) {
          console.log('  (no columns or table missing)');
          continue;
        }
        for (const r of rows) {
          console.log(`  - ${r.column_name} : ${r.data_type}`);
        }
      } catch (e) {
        console.log(`\nTable: ${t}`);
        console.log('  Error reading columns:', e.message);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

run();
