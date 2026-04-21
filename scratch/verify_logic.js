const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

function parseTask(rawText) {
    const text = rawText.toLowerCase().trim();
    let parts = text.split(' ');
    let tanggal = dayjs().format('YYYY-MM-DD');
    let deskripsi = '';

    if (text.startsWith('besok ') || text.startsWith('tomorrow ')) {
        deskripsi = rawText.split(' ').slice(1).join(' ').trim();
        tanggal = dayjs().add(1, 'day').format('YYYY-MM-DD');
    } else if (text.startsWith('task')) {
        if (parts.length >= 3 && dayjs(parts[1], 'YYYY-MM-DD', true).isValid()) {
            tanggal = parts[1];
            deskripsi = rawText.split(' ').slice(2).join(' ').trim();
        } else if (parts[1] === 'besok' || parts[1] === 'tomorrow') {
            tanggal = dayjs().add(1, 'day').format('YYYY-MM-DD');
            deskripsi = rawText.split(' ').slice(2).join(' ').trim();
        } else {
            deskripsi = rawText.split(' ').slice(1).join(' ').trim();
        }
    }
    return { tanggal, deskripsi };
}

const tests = [
    "task belajar math",
    "task 2026-05-01 beli buku",
    "task besok olahraga",
    "besok jalan santai",
    "tomorrow focus work"
];

tests.forEach(t => {
    console.log(`Input: "${t}" -> Result:`, parseTask(t));
});
