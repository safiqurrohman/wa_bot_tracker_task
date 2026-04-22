const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/db');
const dayjs = require('dayjs');
const crypto = require('crypto');
const express = require('express');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

const app = express();
const port = process.env.PORT || 3000;
let latestQR = '';

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1015901307-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    }
});

client.on('qr', (qr) => {
    latestQR = qr;
    console.log('--- QR CODE BARU TERSEDIA ---');
    console.log('SILAKAN BUKA URL PUBLIK BOT ANDA UNTUK SCAN');
    console.log('ATAU BUKA LINK INI:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log('-----------------------------');
});

app.get('/', (req, res) => {
    if (!latestQR) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1>Bot Sedang Loading...</h1>
                <p>Status: Menyiapkan browser. Harap tunggu 10-20 detik lalu refresh halaman ini.</p>
                <script>setTimeout(() => { location.reload(); }, 5000);</script>
            </div>
        `);
    }
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(latestQR)}`;
    res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
            <h1 style="color:#25D366;">WhatsApp Bot Tracker - Login</h1>
            <p>Silakan scan menggunakan WhatsApp di HP Anda (Perangkat Tautan)</p>
            <div style="background:white; display:inline-block; padding:20px; border-radius:15px; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                <img src="${qrImg}" />
            </div>
            <br><br>
            <p style="color:#666;">QR Code akan otomatis terupdate. Jangan tutup halaman ini sampai login berhasil.</p>
            <script>setTimeout(() => { location.reload(); }, 40000);</script>
        </div>
    `);
});

app.listen(port, () => {
    console.log(`Web Server QR aktif di port ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} sudah terpakai. Mencoba port lain...`);
        app.listen(0); // Biarkan OS memilih port bebas
    } else {
        console.error('❌ Server error:', err);
    }
});

client.on('ready', () => {
    console.log('✅ Bot siap!');
});

// OPTIONAL DEBUG
client.on('auth_failure', msg => {
    console.error('AUTH ERROR:', msg);
});

client.on('disconnected', reason => {
    console.log('Bot disconnect:', reason);
});

client.on('message_create', async (message) => {
    const rawText = message.body;
    if (!rawText) return;

    const text = rawText.toLowerCase().trim();
    
    // Hashing user phone untuk privacy
    const user = crypto.createHash('sha256').update(message.from).digest('hex');

    // Abaikan pesan yang dikirim oleh bot sendiri agar tidak looping
    const isBotResponse = rawText.startsWith('✅') || 
                         rawText.startsWith('❌') || 
                         rawText.startsWith('📅') || 
                         rawText.startsWith('📊') || 
                         rawText.startsWith('⏳') || 
                         rawText.startsWith('🗑️') ||
                         rawText.startsWith('📈');

    if (message.fromMe && isBotResponse) {
        return;
    }


    // ===== PING TEST =====
    if (text === 'test') {
        return message.reply('Layanan Aktif');
    }

    // ===== TAMBAH TASK (BESOK / TOMORROW) =====
    if (text.startsWith('besok ') || text.startsWith('tomorrow ')) {
        const deskripsi = rawText.split(' ').slice(1).join(' ').trim();
        const tanggal = dayjs().add(1, 'day').format('YYYY-MM-DD');

        if (!deskripsi) return; 

        db.query(
            'INSERT INTO tasks (user_phone, tanggal, deskripsi) VALUES (?, ?, ?)',
            [user, tanggal, deskripsi],
            (err) => {
                if (err) {
                    console.error('DB Error:', err);
                    return message.reply('❌ Gagal simpan task besok');
                }
                message.reply(`✅ Task "${deskripsi}" disimpan untuk besok (${tanggal})`);
            }
        );
        return;
    }

    // ===== TAMBAH TASK (GENERAL) =====
    if (text.startsWith('task ')) {
        let parts = text.split(' ');
        let tanggal = dayjs().format('YYYY-MM-DD');
        let deskripsi = '';

        if (parts.length >= 3 && dayjs(parts[1], 'YYYY-MM-DD', true).isValid()) {
            tanggal = parts[1];
            deskripsi = rawText.split(' ').slice(2).join(' ').trim();
        } else if (parts[1] === 'besok' || parts[1] === 'tomorrow') {
            tanggal = dayjs().add(1, 'day').format('YYYY-MM-DD');
            deskripsi = rawText.split(' ').slice(2).join(' ').trim();
        } else {
            deskripsi = rawText.split(' ').slice(1).join(' ').trim();
        }

        if (!deskripsi) {
            return message.reply('❌ Deskripsi task kosong. Contoh: task belajar');
        }

        db.query(
            'INSERT INTO tasks (user_phone, tanggal, deskripsi) VALUES (?, ?, ?)',
            [user, tanggal, deskripsi],
            (err) => {
                if (err) {
                    console.error('DB Error:', err);
                    return message.reply('❌ Gagal simpan task');
                }
                message.reply(`✅ Task "${deskripsi}" tersimpan untuk ${tanggal}`);
            }
        );
        return;
    }

    // ===== LIST: TODAY / HARI INI =====
    if (text === 'today' || text === 'hari ini') {
        const today = dayjs().format('YYYY-MM-DD');
        db.query(
            'SELECT * FROM tasks WHERE tanggal = ? AND user_phone = ? ORDER BY id ASC',
            [today, user],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply('📭 Tidak ada task hari ini');

                let response = `📅 *Task Hari Ini (${today})*\n`;
                response += `━━━━━━━━━━━━━━\n`;
                results.forEach((task) => {
                    const status = task.status === 1 ? '✅' : '❌';
                    response += `Code :${task.id} ${status} ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ===== LIST: BESOK / TOMORROW =====
    if (text === 'besok' || text === 'tomorrow') {
        const besok = dayjs().add(1, 'day').format('YYYY-MM-DD');
        db.query(
            'SELECT * FROM tasks WHERE tanggal = ? AND user_phone = ? ORDER BY id ASC',
            [besok, user],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply('📭 Tidak ada task untuk besok');

                let response = `📅 *Task Besok (${besok})*\n`;
                response += `━━━━━━━━━━━━━━\n`;
                results.forEach((task) => {
                    const status = task.status === 1 ? '✅' : '❌';
                    response += `Code :${task.id} ${status} ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ===== LIST: PREVIOUS (KEMARIN / AGO) =====
    const agoMatch = text.match(/(\d+)\s*(hari sebelumnya|days ago)/);
    if (agoMatch || text === 'kemarin' || text === 'yesterday') {
        let daysAgo = 1;
        if (agoMatch) {
            daysAgo = parseInt(agoMatch[1]);
        }
        const targetDate = dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD');

        db.query(
            'SELECT * FROM tasks WHERE tanggal = ? AND user_phone = ? ORDER BY id ASC',
            [targetDate, user],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply(`📭 Tidak ada task pada ${targetDate}`);

                let response = `📅 *Task ${daysAgo === 1 ? 'Kemarin' : daysAgo + ' Hari Lalu'} (${targetDate})*\n`;
                response += `━━━━━━━━━━━━━━\n`;
                results.forEach((task) => {
                    const status = task.status === 1 ? '✅' : '❌';
                    response += `Code :${task.id} ${status} ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ===== LIST: ALL / SEMUA =====
    if (text === 'all' || text === 'semua') {
        const today = dayjs().format('YYYY-MM-DD');
        db.query(
            'SELECT * FROM tasks WHERE user_phone = ? AND tanggal >= ? ORDER BY tanggal ASC, id ASC',
            [user, today],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply('📭 Anda belum memiliki task mendatang');

                let response = `📊 *Daftar Semua Task*\n`;
                let currentDate = '';

                results.forEach((task) => {
                    const tgl = dayjs(task.tanggal).format('YYYY-MM-DD');
                    if (tgl !== currentDate) {
                        response += `\n*📅 Tanggal: ${tgl}*\n`;
                        response += `━━━━━━━━━━━━━━\n`;
                        currentDate = tgl;
                    }
                    const status = task.status === 1 ? '✅' : '❌';
                    response += `Code :${task.id} ${status} ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ===== LIST: BELUM SELESAI =====
    if (text === 'belum selesai' || text === 'pending') {
        db.query(
            'SELECT * FROM tasks WHERE user_phone = ? AND status = 0 ORDER BY tanggal ASC',
            [user],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply('🎉 Semua task sudah selesai!');

                let response = `⏳ *Task Belum Selesai*\n`;
                response += `━━━━━━━━━━━━━━\n`;
                results.forEach((task) => {
                    const tgl = dayjs(task.tanggal).format('YYYY-MM-DD');
                    response += `Code :${task.id} (${tgl}) ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ===== REPORT COMMANDS =====
    if (text.startsWith('report') || text.startsWith('laporan')) {
        let startDate, endDate, title;
        const parts = text.split(' ');

        if (parts.length === 1) {
            // General Report (All time)
            title = 'Semua Waktu';
            db.query(
                'SELECT * FROM tasks WHERE user_phone = ? ORDER BY tanggal DESC, id DESC',
                [user],
                (err, results) => handleReport(err, results, title)
            );
        } else {
            const range = parts[1];
            endDate = dayjs().format('YYYY-MM-DD');

            if (range === '1w' || text.includes('1 minggu')) {
                startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
                title = '1 Minggu Terakhir';
            } else if (range === '2w' || text.includes('2 minggu')) {
                startDate = dayjs().subtract(14, 'day').format('YYYY-MM-DD');
                title = '2 Minggu Terakhir';
            } else if (range === '1m' || text.includes('1 bulan')) {
                startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                title = '1 Bulan Terakhir';
            } else if (dayjs(range, 'YYYY-MM-DD', true).isValid()) {
                // Custom Date Report (7 days from start date)
                startDate = range;
                endDate = dayjs(range).add(7, 'day').format('YYYY-MM-DD');
                title = `Minggu: ${startDate} s/d ${endDate}`;
            } else {
                return message.reply('❌ Format report salah. Contoh: report 1w, report 1m, atau report 2026-04-01');
            }

            db.query(
                'SELECT * FROM tasks WHERE user_phone = ? AND tanggal BETWEEN ? AND ? ORDER BY tanggal DESC, id DESC',
                [user, startDate, endDate],
                (err, results) => handleReport(err, results, title)
            );
        }

        function handleReport(err, results, rangeTitle) {
            if (err) return message.reply('❌ Error ambil data report');
            
            let total = results.length;
            let selesaiList = [];
            let belumList = [];

            results.forEach(task => {
                const tgl = dayjs(task.tanggal).format('YYYY-MM-DD');
                const line = `- [${task.id}] (${tgl}) ${task.deskripsi}`;
                if (task.status === 1) selesaiList.push(line);
                else belumList.push(line);
            });

            let selesai = selesaiList.length;
            let belum = belumList.length;
            const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;
            const totalBars = 10;
            const activeBars = Math.round((persen / 100) * totalBars);
            const barStr = '▓'.repeat(activeBars) + '░'.repeat(totalBars - activeBars);

            let response = `📈 *Laporan Progress Task*\n`;
            response += `📌 *Rentang: ${rangeTitle}*\n`;
            response += `━━━━━━━━━━━━━━\n\n`;
            response += `✅ Selesai      : ${selesai}\n`;
            response += `❌ Belum        : ${belum}\n`;
            response += `📝 Total        : ${total}\n\n`;
            response += `*Progress: [${barStr}] ${persen}%*\n\n`;
            response += `━━━━━━━━━━━━━━\n`;

            if (selesaiList.length > 0) {
                response += `✅ *Task Selesai*:\n${selesaiList.join('\n')}\n\n`;
            }

            if (belumList.length > 0) {
                response += `❌ *Belum Selesai*:\n${belumList.join('\n')}\n`;
            }

            if (total === 0) {
                response += `📭 Tidak ada data task untuk rentang ini.`;
            }

            message.reply(response);
        }
        return;
    }

    // ===== DONE TASK (BY ID) =====
    if (text.startsWith('done ') || text.startsWith('selesai ')) {
        const idStr = text.split(' ')[1];
        const id = parseInt(idStr);
        if (!id) return message.reply('❌ Format salah. Contoh: done 12');

        db.query('UPDATE tasks SET status = 1 WHERE id = ? AND user_phone = ?', [id, user], (err, result) => {
            if (err) return message.reply('❌ Gagal update task');
            if (result.affectedRows === 0) return message.reply('❌ ID task tidak ditemukan');
            message.reply(`✅ Task Code:${id} ditandai selesai`);
        });
        return;
    }

    // ===== HAPUS TASK (BY ID) =====
    if (text.startsWith('hapus ') || text.startsWith('delete ')) {
        const idStr = text.split(' ')[1];
        const id = parseInt(idStr);
        if (!id) return message.reply('❌ Format salah. Contoh: hapus 12');

        db.query('DELETE FROM tasks WHERE id = ? AND user_phone = ?', [id, user], (err, result) => {
            if (err) return message.reply('❌ Gagal menghapus task');
            if (result.affectedRows === 0) return message.reply('❌ ID task tidak ditemukan');
            message.reply(`🗑️ Task Code:${id} telah dihapus`);
        });
        return;
    }

    // ===== LIST BY TANGGAL (YYYY-MM-DD) =====
    if (dayjs(text, 'YYYY-MM-DD', true).isValid()) {
        db.query(
            'SELECT * FROM tasks WHERE tanggal = ? AND user_phone = ? ORDER BY id ASC',
            [text, user],
            (err, results) => {
                if (err) return message.reply('❌ Error ambil data');
                if (results.length === 0) return message.reply(`📭 Tidak ada task di ${text}`);

                let response = `📅 *Daftar Task: ${text}*\n`;
                response += `━━━━━━━━━━━━━━\n`;
                results.forEach((task) => {
                    const status = task.status === 1 ? '✅' : '❌';
                    response += `Code :${task.id} ${status} ${task.deskripsi}\n`;
                });
                message.reply(response);
            }
        );
        return;
    }

    // ==========================================
    // ===== SISTEM KEUANGAN (BUDGETING) =======
    // ==========================================

    // 1. SET BUDGET: budget [kategori] [nominal]
    if (text.startsWith('budget ')) {
        const parts = text.split(' ');
        if (parts.length < 3) return message.reply('❌ Format salah. Contoh: budget makan 1000000');
        
        const kategori = parts[1];
        const nominal = parseFloat(parts[2]);
        const bulan = dayjs().format('YYYY-MM');

        if (isNaN(nominal)) return message.reply('❌ Nominal harus angka');

        const query = `
            INSERT INTO budgets (user_phone, kategori, nominal, bulan) 
            VALUES (?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE nominal = VALUES(nominal)
        `;
        db.query(query, [user, kategori, nominal, bulan], (err) => {
            if (err) return message.reply('❌ Gagal simpan budget');
            message.reply(`✅ Budget *${kategori}* bulan ini diset ke ${formatRupiah(nominal)}`);
        });
        return;
    }

    // 2. CATAT BELANJA: beli [kategori] [nominal] [deskripsi]
    if (text.startsWith('beli ')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) return message.reply('❌ Format salah. Contoh: beli makan 20000 nasi padang');

        const kategori = parts[1].toLowerCase();
        const nominal = parseFloat(parts[2]);
        const deskripsi = parts.slice(3).join(' ') || kategori;
        const bulan = dayjs().format('YYYY-MM');
        const tanggal = dayjs().format('YYYY-MM-DD');

        if (isNaN(nominal)) return message.reply('❌ Nominal harus angka');

        // Simpan pengeluaran
        db.query(
            'INSERT INTO expenses (user_phone, kategori, nominal, deskripsi, tanggal) VALUES (?, ?, ?, ?, ?)',
            [user, kategori, nominal, deskripsi, tanggal],
            (err, result) => {
                if (err) return message.reply('❌ Gagal simpan pengeluaran');
                const lastId = result.insertId;

                // Hitung sisa budget
                const budgetQuery = `
                    SELECT 
                        (SELECT nominal FROM budgets WHERE user_phone = ? AND kategori = ? AND bulan = ?) as budget,
                        (SELECT SUM(nominal) FROM expenses WHERE user_phone = ? AND kategori = ? AND tanggal LIKE ?) as terpakai
                `;
                db.query(budgetQuery, [user, kategori, bulan, user, kategori, `${bulan}%`], (bErr, bRows) => {
                    let response = `✅ *Tercatat (ID:${lastId})*\n`;
                    response += `🛍️ Item: ${deskripsi}\n`;
                    response += `💰 Harga: ${formatRupiah(nominal)}\n`;
                    response += `━━━━━━━━━━━━━━\n`;

                    if (!bErr && bRows[0].budget) {
                        const sisa = bRows[0].budget - bRows[0].terpakai;
                        response += `📉 Sisa Budget *${kategori}*: ${formatRupiah(sisa)}`;
                        if (sisa < 0) response += `\n⚠️ *OVER BUDGET!*`;
                    }
                    message.reply(response);
                });
            }
        );
        return;
    }

    // 3. SISA UANG / BUDGET
    if (text === 'sisa uang' || text === 'budget') {
        const bulan = dayjs().format('YYYY-MM');
        const query = `
            SELECT b.kategori, b.nominal as budget, IFNULL(SUM(e.nominal), 0) as terpakai
            FROM budgets b
            LEFT JOIN expenses e ON b.kategori = e.kategori AND b.user_phone = e.user_phone AND e.tanggal LIKE ?
            WHERE b.user_phone = ? AND b.bulan = ?
            GROUP BY b.kategori
        `;
        db.query(query, [`${bulan}%`, user, bulan], (err, rows) => {
            if (err) return message.reply('❌ Gagal ambil data budget');
            if (rows.length === 0) return message.reply('📭 Anda belum mengatur budget bulan ini.');

            let response = `📊 *Anggaran Bulan Ini (${bulan})*\n`;
            response += `━━━━━━━━━━━━━━\n`;
            let grandTotalSisa = 0;

            rows.forEach(row => {
                const sisa = row.budget - row.terpakai;
                grandTotalSisa += sisa;
                response += `*${row.kategori.toUpperCase()}*\n`;
                response += `Budget: ${formatRupiah(row.budget)}\n`;
                response += `Pakai : ${formatRupiah(row.terpakai)}\n`;
                response += `Sisa  : *${formatRupiah(sisa)}*\n\n`;
            });

            response += `━━━━━━━━━━━━━━\n`;
            response += `💰 *Total Sisa: ${formatRupiah(grandTotalSisa)}*`;
            message.reply(response);
        });
        return;
    }

    // 4. PENGELUARAN HARI INI
    if (text === 'uang hari ini') {
        const tanggal = dayjs().format('YYYY-MM-DD');
        db.query('SELECT * FROM expenses WHERE user_phone = ? AND tanggal = ?', [user, tanggal], (err, rows) => {
            if (err) return message.reply('❌ Gagal ambil data harian');
            if (rows.length === 0) return message.reply('📭 Belum ada pengeluaran hari ini.');

            let total = 0;
            let response = `💸 *Pengeluaran Hari Ini (${tanggal})*\n`;
            response += `━━━━━━━━━━━━━━\n`;
            rows.forEach(row => {
                total += parseFloat(row.nominal);
                response += `ID:${row.id} [${row.kategori}] ${row.diskripsi}: ${formatRupiah(row.nominal)}\n`;
            });
            response += `━━━━━━━━━━━━━━\n`;
            response += `💰 *Total: ${formatRupiah(total)}*`;
            message.reply(response);
        });
        return;
    }

    // 5. HAPUS PENGELUARAN
    if (text.startsWith('hapus uang ')) {
        const id = text.split(' ')[2];
        db.query('DELETE FROM expenses WHERE id = ? AND user_phone = ?', [id, user], (err, result) => {
            if (err) return message.reply('❌ Gagal hapus data');
            if (result.affectedRows === 0) return message.reply('❌ ID pengeluaran tidak ditemukan');
            message.reply(`🗑️ Data pengeluaran ID:${id} telah dihapus`);
        });
        return;
    }
});

client.initialize();