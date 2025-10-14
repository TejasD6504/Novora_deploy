// show-constraints.js - show check constraints for 'task' table
const db = require('./db');

(async function() {
  try {
    const rows = await db.query("SELECT conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = $1", ['task']);
    console.log('Constraints on task:');
    console.log(rows);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
