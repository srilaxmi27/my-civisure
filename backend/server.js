const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const sosRoutes = require('./routes/sos');
const chatbotRoutes = require('./routes/chatbot');
const adminRoutes = require('./routes/admin');

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'your-domain.com' : '*',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'civisure-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-admin', () => {
        socket.join('admin-room');
        console.log('Admin joined room');
    });

    socket.on('sos-alert', (data) => {
        io.to('admin-room').emit('new-sos', data);
        console.log('SOS Alert broadcasted:', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║       CiviSure Server Running         ║
    ║                                       ║
    ║   Port: ${PORT}                        ║
    ║   Environment: ${process.env.NODE_ENV || 'development'}           ║
    ║   URL: http://localhost:${PORT}        ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
    `);
});

module.exports = { app, io };