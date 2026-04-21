const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/db');
const dayjs = require('dayjs');
const crypto = require('crypto');
const express = require('express');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const app = express();
const port = process.env.PORT || 3000;
let latestQR = '';

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014610951-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    }
});

client.on('qr', (qr) => {
    latestQR = qr;
    console.log('--- QR CODE DETECTED ---');
    // Generate URL for scanning if terminal is messy
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    console.log('Jika QR di atas rusak, buka link ini:');
    console.log(qrUrl);
    console.log('------------------------');
    
    // Tetap print ke terminal (opsional)
    qrcode.generate(qr, { small: true });
});

app.get('/', (req, res) => {
    if (!latestQR) {
        return res.send('<h1>Bot sedang loading atau sudah login.</h1>');
    }
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(latestQR)}`;
    res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
            <h1>Scan QR Code untuk Login Bot</h1>
            <p>Silakan scan menggunakan WhatsApp di HP Anda (Linked Devices)</p>
            <img src="${qrImg}" style="border: 10px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.2);" />
            <br><br>
            <p>Status: Menunggu Scan...</p>
        </div>
    `);
});

app.listen(port, () => {
    console.log(`Server QR aktif di port ${port}`);
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
    // Hashing user phone for privacy
    const user = crypto.createHash('sha256').update(message.from).digest('hex');

    // Abaikan pesan yang dikirim oleh bot sendiri agar tidak looping
    if (message.fromMe && (
        rawText.startsWith('✅') || 
        rawText.startsWith('❌') || 
        rawText.startsWith('📅') || 
        rawText.startsWith('📊') || 
        rawText.startsWith('⏳') || 
        rawText.startsWith('🗑️') ||
        rawText.startsWith('📈')
    )) {
        return;
    }

    // Logging untuk debug (tetap menggunakan JID asli di console agar admin tahu pengirimnya)
    console.log(`[${dayjs().format('HH:mm:ss')}] Pesan dari ${message.from}: ${rawText}`);

    // ===== PING TEST =====
    if (text === 'ping') {
        return message.reply('pong');
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
});

client.initialize();