const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa_tracker'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Gagal koneksi database:', err);
    } else {
        console.log('✅ Database terhubung');
    }
});

module.exports = db;