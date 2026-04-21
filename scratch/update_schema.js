const db = require('../config/db');

db.query('ALTER TABLE tasks MODIFY COLUMN user_phone VARCHAR(50)', (err) => {
    if (err) {
        console.error('Error updating table:', err);
    } else {
        console.log('✅ Column user_phone updated to VARCHAR(50)');
    }
    process.exit();
});
