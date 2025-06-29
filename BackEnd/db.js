const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '5729053996mM',
  database: process.env.DB_NAME || 'salla',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// اختبار الاتصال
pool.getConnection()
  .then(conn => {
    console.log(' تم الاتصال بقاعدة البيانات بنجاح!');
    conn.release();
  })
  .catch(err => {
    console.error(' فشل الاتصال بقاعدة البيانات:', err);
    process.exit(1);
  });

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params)
};