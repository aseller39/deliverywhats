const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;


async function prepararBanco() {
    await pool.query(`
        ALTER TABLE pedidos
        ADD COLUMN IF NOT EXISTS inicio_preparo TIMESTAMP;
    `);
}

prepararBanco().catch(console.error);