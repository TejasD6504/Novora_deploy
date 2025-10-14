// db.js - unified DB layer: supports PostgreSQL (default) and MySQL as fallback
const dbType = (process.env.DB_TYPE || 'pg').toLowerCase();

if (dbType === 'pg') {
  // PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'root',
  // default to the 'warehouse1' database you created in pgAdmin (matches screenshot)
  database: process.env.DB_NAME || 'warehouse1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  });

  module.exports = {
    query: async (text, params) => {
      const res = await pool.query(text, params);
      return res.rows;
    },
    pool
  };
} else {
  // MySQL fallback
  const mysql = require('mysql2');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root',
    database: process.env.DB_NAME || 'warehouse1',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const p = pool.promise();
  module.exports = {
    query: async (text, params) => {
      const [rows] = await p.query(text, params);
      return rows;
    },
    pool: p
  };
}
