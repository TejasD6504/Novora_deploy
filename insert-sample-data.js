// insert-sample-data.js - insert safe sample rows into user's Postgres tables
const db = require('./db');

async function run() {
  try {
    console.log('Inserting sample data...');

    // products
    await db.query("INSERT INTO product (productid, name) VALUES ($1, $2) ON CONFLICT (productid) DO NOTHING", ['P1', 'Widget A']);
    await db.query("INSERT INTO product (productid, name) VALUES ($1, $2) ON CONFLICT (productid) DO NOTHING", ['P2', 'Widget B']);
    await db.query("INSERT INTO product (productid, name) VALUES ($1, $2) ON CONFLICT (productid) DO NOTHING", ['P3', 'Widget C']);

    // racks
    await db.query("INSERT INTO rack (rackid, capacity) VALUES ($1, $2) ON CONFLICT (rackid) DO NOTHING", ['R1', 100]);
    await db.query("INSERT INTO rack (rackid, capacity) VALUES ($1, $2) ON CONFLICT (rackid) DO NOTHING", ['R2', 80]);

    // robots
    await db.query("INSERT INTO robot (robotid, currenttaskid, status) VALUES ($1, $2, $3) ON CONFLICT (robotid) DO NOTHING", ['RB1', null, 'active']);
    await db.query("INSERT INTO robot (robotid, currenttaskid, status) VALUES ($1, $2, $3) ON CONFLICT (robotid) DO NOTHING", ['RB2', null, 'idle']);

    // tasks
  await db.query("INSERT INTO task (task_id, \"Type\", source_address, destination_address, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (task_id) DO NOTHING", ['T100', 'Pick', 'Node A', 'Node C', 'ongoing']);
  await db.query("INSERT INTO task (task_id, \"Type\", source_address, destination_address, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (task_id) DO NOTHING", ['T101', 'Drop', 'Node D', 'Node H', 'completed']);
  await db.query("INSERT INTO task (task_id, \"Type\", source_address, destination_address, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (task_id) DO NOTHING", ['T102', 'Pick', 'Node B', 'Node E', 'pending']);

    // storagelocation
    await db.query("INSERT INTO storagelocation (address, isempty, rackid, productid) VALUES ($1, $2, $3, $4) ON CONFLICT (address) DO NOTHING", ['S1', false, 'R1', 'P1']);
    await db.query("INSERT INTO storagelocation (address, isempty, rackid, productid) VALUES ($1, $2, $3, $4) ON CONFLICT (address) DO NOTHING", ['S2', true, 'R2', null]);

    console.log('Sample data inserted.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to insert sample data:', err.message);
    process.exit(1);
  }
}

run();
