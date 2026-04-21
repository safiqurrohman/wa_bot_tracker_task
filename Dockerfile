# Gunakan Node.js versi 18 atau 20 (slim)
FROM node:20-slim

# Instal dependensi yang dibutuhkan Chromium agar bisa jalan di Linux server
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Atur Environment Variable agar Puppeteer memakai Chromium yang sudah diinstal
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Tentukan folder kerja
WORKDIR /usr/src/app

# Copy package.json dan package-lock.json
COPY package*.json ./

# Instal dependensi bot
RUN npm install

# Copy semua file ke dalam container
COPY . .

# Jalankan bot (sesuaikan path ke file index Anda)
CMD [ "node", "bot/index.js" ]
