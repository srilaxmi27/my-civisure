const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/', requireAuth, (req, res) => {
    try {
        const { locationLat, locationLng, locationAddress, message } = req.body;

        if (!locationLat || !locationLng) {
            return res.status(400).json({
                success: false,
                message: 'Location is required'
            });
        }

        const user = db.prepare('SELECT id, email, full_name, phone FROM users WHERE id = ?').get(req.session.userId);

        const stmt = db.prepare(`
            INSERT INTO sos_alerts 
            (user_id, location_lat, location_lng, location_address, message, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        `);

        const result = stmt.run(
            req.session.userId,
            parseFloat(locationLat),
            parseFloat(locationLng),
            locationAddress || null,
            message || 'Emergency! Need immediate assistance!'
        );

        const alertData = {
            id: result.lastInsertRowid,
            user: {
                id: user.id,
                name: user.full_name,
                email: user.email,
                phone: user.phone
            },
            location: {
                lat: parseFloat(locationLat),
                lng: parseFloat(locationLng),
                address: locationAddress
            },
            message: message || 'Emergency! Need immediate assistance!',
            timestamp: new Date().toISOString()
        };

        if (req.io) {
            req.io.to('admin-room').emit('new-sos', alertData);
        }

        res.status(201).json({
            success: true,
            message: 'SOS alert sent successfully',
            alertId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('SOS alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send SOS alert'
        });
    }
});

router.get('/active', requireAdmin, (req, res) => {
    try {
        const alerts = db.prepare(`
            SELECT 
                s.*,
                u.email,
                u.full_name,
                u.phone
            FROM sos_alerts s
            JOIN users u ON s.user_id = u.id
            WHERE s.status = 'active'
            ORDER BY s.created_at DESC
        `).all();

        res.json({
            success: true,
            alerts
        });

    } catch (error) {
        console.error('Get active SOS error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active SOS alerts'
        });
    }
});

router.get('/', requireAdmin, (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                s.*,
                u.email,
                u.full_name,
                u.phone
            FROM sos_alerts s
            JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }

        query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const alerts = db.prepare(query).all(...params);

        res.json({
            success: true,
            alerts
        });

    } catch (error) {
        console.error('Get SOS alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch SOS alerts'
        });
    }
});

router.get('/:id', requireAdmin, (req, res) => {
    try {
        const alert = db.prepare(`
            SELECT 
                s.*,
                u.email,
                u.full_name,
                u.phone
            FROM sos_alerts s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `).get(req.params.id);

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'SOS alert not found'
            });
        }

        res.json({
            success: true,
            alert
        });

    } catch (error) {
        console.error('Get SOS alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch SOS alert'
        });
    }
});

router.put('/:id', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['active', 'responded', 'resolved', 'false_alarm'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const resolvedAt = (status === 'resolved' || status === 'false_alarm') 
            ? new Date().toISOString() 
            : null;

        const stmt = db.prepare(`
            UPDATE sos_alerts 
            SET status = ?, resolved_at = ?
            WHERE id = ?
        `);

        const result = stmt.run(status, resolvedAt, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'SOS alert not found'
            });
        }

        if (req.io) {
            req.io.to('admin-room').emit('sos-updated', {
                id: req.params.id,
                status,
                resolvedAt
            });
        }

        res.json({
            success: true,
            message: 'SOS alert status updated'
        });

    } catch (error) {
        console.error('Update SOS alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update SOS alert'
        });
    }
});

router.get('/user/history', requireAuth, (req, res) => {
    try {
        const alerts = db.prepare(`
            SELECT *
            FROM sos_alerts
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `).all(req.session.userId);

        res.json({
            success: true,
            alerts
        });

    } catch (error) {
        console.error('Get user SOS history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch SOS history'
        });
    }
});

module.exports = router;