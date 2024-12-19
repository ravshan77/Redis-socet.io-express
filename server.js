const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Redis uchun ulanishlar
const redisSubscriber = new Redis({
    host: 'gusc1-liberal-sailfish-30885.upstash.io',
    port: 30885,
    password: '11e5a62afcf84437b5c3995a07a7b489',
    tls: {},
});

const redisPublisher = new Redis({
    host: 'gusc1-liberal-sailfish-30885.upstash.io',
    port: 30885,
    password: '11e5a62afcf84437b5c3995a07a7b489',
    tls: {},
});

// Express JSON parser
app.use(express.json());

// Redis-dan xabarlarni olish va Socket.IO orqali uzatish
redisSubscriber.psubscribe('*', (err, count) => {
    if (err) {
        console.error('Redis-ga ulanishda xato:', err);
    } else {
        console.log(`Redis-da ${count} kanal tinglanmoqda.`);
    }
});

redisSubscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`Kanal: ${channel}, Xabar: ${message}, Pattern: ${pattern}`);
    try {
        message = JSON.parse(message); // JSON xabarni o'qish
    } catch (e) {
        console.error('Xato: JSONni o\'qib bo\'lmadi', e);
    }
    io.emit(channel, message); // Xabarni barcha Socket.IO mijozlariga uzatish
});

// HTTP endpoint orqali xabar yuborish (Postman uchun)
app.post('/send-message', (req, res) => {
    const { channel, message } = req.body;

    if (!channel || !message) {
        return res.status(400).json({ error: 'Kanal va xabarni kiritish majburiy' });
    }

    // Redis orqali xabarni yuborish
    redisPublisher.publish(channel, JSON.stringify({ from: 'HTTP Client', message }));

    res.status(200).json({ success: true, message: 'Xabar muvaffaqiyatli yuborildi.' });
    console.log(`Message: ${message}`);
});

// Socket.IO ulanishlari bilan ishlash
io.on('connection', (socket) => {
    console.log('Mijoz ulandi:', socket.id);

    // Socket.IO orqali mijozdan xabarni olish
    socket.on('chat message', (data) => {
        console.log(`Socket.IO Xabar: ${data.from} -> ${data.message}`);

        // Xabarni barcha mijozlarga uzatish
        io.emit('chat message', data);

        // Redis orqali xabarni uzatish (ixtiyoriy)
        redisPublisher.publish('chat message', JSON.stringify(data));
    });

    socket.on('disconnect', () => {
        console.log('Mijoz uzildi:', socket.id);
    });
});

// Serverni ishga tushirish
server.listen(30885, () => {
    console.log('Socket.IO server 30885-portda ishlamoqda.');
});
