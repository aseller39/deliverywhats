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

    await pool.query(`
        ALTER TABLE restaurantes
        ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
    `);
}

prepararBanco().catch(console.error);