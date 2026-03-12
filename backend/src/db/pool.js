import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('✅  PostgreSQL connected');
}).catch((err) => {
  console.error('❌  PostgreSQL connection failed:', err.message);
});

export default pool;
