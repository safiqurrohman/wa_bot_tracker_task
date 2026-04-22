const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'wa_task_tracker',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error('❌ Gagal koneksi database:', err);
    } else {
        console.log('✅ Database terhubung');
        
        // Buat tabel jika belum ada (memudahkan setup di Railway)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_phone VARCHAR(100),
                tanggal DATE,
                deskripsi TEXT,
                status TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        db.query(createTableQuery, (err) => {
            if (err) console.error('❌ Gagal inisialisasi tabel:', err);
            else console.log('✅ Tabel "tasks" siap digunakan');
        });
    }
});

module.exports = db;