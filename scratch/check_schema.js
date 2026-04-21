const db = require('../config/db');

db.query('DESCRIBE tasks', (err, results) => {
    if (err) {
        console.error('Error describing table:', err);
    } else {
        console.log('Table structure:', results);
    }
    process.exit();
});
