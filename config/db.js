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
        
        // Buat tabel tasks
        const createTasksQuery = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_phone VARCHAR(100),
                tanggal DATE,
                deskripsi TEXT,
                status TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        db.query(createTasksQuery, (err) => {
            if (err) console.error('❌ Gagal inisialisasi tabel tasks:', err);
            else console.log('✅ Tabel "tasks" siap digunakan');
        });

        // 1. Buat tabel budgets (NEW)
        const createBudgetsQuery = `
            CREATE TABLE IF NOT EXISTS budgets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_phone VARCHAR(100),
                kategori VARCHAR(50),
                nominal DECIMAL(15, 2),
                bulan VARCHAR(7),
                UNIQUE KEY unique_budget (user_phone, kategori, bulan)
            )
        `;
        db.query(createBudgetsQuery, (err) => {
            if (err) console.error('❌ Gagal inisialisasi tabel budgets:', err);
            else console.log('✅ Tabel "budgets" siap digunakan');
        });

        // 2. Buat tabel expenses (NEW)
        const createExpensesQuery = `
            CREATE TABLE IF NOT EXISTS expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_phone VARCHAR(100),
                kategori VARCHAR(50),
                nominal DECIMAL(15, 2),
                deskripsi TEXT,
                tanggal DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        db.query(createExpensesQuery, (err) => {
            if (err) console.error('❌ Gagal inisialisasi tabel expenses:', err);
            else console.log('✅ Tabel "expenses" siap digunakan');
        });
    }
});

module.exports = db;