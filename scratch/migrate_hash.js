const db = require('../config/db');
const crypto = require('crypto');

function getHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

db.query('SELECT DISTINCT user_phone FROM tasks', (err, rows) => {
    if (err) {
        console.error('Error selecting users:', err);
        process.exit(1);
    }

    if (rows.length === 0) {
        console.log('No users to migrate.');
        process.exit(0);
    }

    console.log(`Starting migration for ${rows.length} unique phone numbers...`);

    let completed = 0;
    rows.forEach(row => {
        const original = row.user_phone;
        // Check if already hashed (length 64)
        if (original && original.length === 64 && /^[0-9a-f]+$/.test(original)) {
            console.log(`Skipping already hashed: ${original.substring(0, 8)}...`);
            completed++;
            if (completed === rows.length) process.exit(0);
            return;
        }

        const hashed = getHash(original);
        db.query('UPDATE tasks SET user_phone = ? WHERE user_phone = ?', [hashed, original], (uErr) => {
            if (uErr) {
                console.error(`Error updating ${original}:`, uErr);
            } else {
                console.log(`Migrated: ${original} -> ${hashed.substring(0, 8)}...`);
            }
            completed++;
            if (completed === rows.length) {
                console.log('✅ Migration completed!');
                process.exit(0);
            }
        });
    });
});
