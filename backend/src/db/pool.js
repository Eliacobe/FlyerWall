import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('SQL connected');
}).catch((err) => {
  console.error('SQL connection failed:', err.message);
});

export default pool;
