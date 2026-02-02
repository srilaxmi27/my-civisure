const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, phone } = req.body;

        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and full name are required'
            });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

        const stmt = db.prepare(`
            INSERT INTO users (email, password, full_name, phone, role)
            VALUES (?, ?, ?, ?, 'user')
        `);
        
        const result = stmt.run(email, hashedPassword, fullName, phone || null);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            userId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.fullName = user.full_name;
        req.session.role = user.role;

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
});

router.get('/check', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            success: true,
            authenticated: true,
            user: {
                id: req.session.userId,
                email: req.session.email,
                fullName: req.session.fullName,
                role: req.session.role
            }
        });
    } else {
        res.json({
            success: true,
            authenticated: false
        });
    }
});

module.exports = router;