require('dotenv').config();
const app = require('./app');
const { pool } = require('../config/db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  try {
    // Verify DB connection on startup
    const client = await pool.connect();
    client.release();
    console.log(`🚀 Server running on port ${PORT}`);
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
});
