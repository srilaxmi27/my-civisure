const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', requireAuth, upload.array('evidence', 5), async (req, res) => {
    try {
        const { category, description, locationLat, locationLng, locationAddress, dateTime, anonymous } = req.body;

        if (!category || !description || !locationLat || !locationLng || !dateTime) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        let evidenceFiles = null;
        if (req.files && req.files.length > 0) {
            evidenceFiles = JSON.stringify(req.files.map(file => file.filename));
        }

        const userId = anonymous === 'true' ? null : req.session.userId;

        const stmt = db.prepare(`
            INSERT INTO crime_reports 
            (user_id, category, description, location_lat, location_lng, location_address, 
             date_time, evidence_files, anonymous)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            userId,
            category,
            description,
            parseFloat(locationLat),
            parseFloat(locationLng),
            locationAddress || null,
            dateTime,
            evidenceFiles,
            anonymous === 'true' ? 1 : 0
        );

        res.status(201).json({
            success: true,
            message: 'Crime report submitted successfully',
            reportId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report'
        });
    }
});

router.get('/', requireAdmin, (req, res) => {
    try {
        const { status, category, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                r.*,
                u.email as reporter_email,
                u.full_name as reporter_name
            FROM crime_reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        if (category) {
            query += ' AND r.category = ?';
            params.push(category);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const reports = db.prepare(query).all(...params);

        reports.forEach(report => {
            if (report.evidence_files) {
                report.evidence_files = JSON.parse(report.evidence_files);
            }
            if (report.anonymous) {
                report.reporter_email = null;
                report.reporter_name = null;
            }
        });

        res.json({
            success: true,
            reports,
            total: reports.length
        });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reports'
        });
    }
});

router.get('/map', (req, res) => {
    try {
        const { category, days = 30 } = req.query;

        let query = `
            SELECT 
                id,
                category,
                location_lat,
                location_lng,
                location_address,
                date_time,
                status
            FROM crime_reports
            WHERE created_at >= datetime('now', '-' || ? || ' days')
        `;
        const params = [parseInt(days)];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY created_at DESC';

        const reports = db.prepare(query).all(...params);

        res.json({
            success: true,
            reports
        });

    } catch (error) {
        console.error('Get map reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch map data'
        });
    }
});

router.get('/:id', requireAdmin, (req, res) => {
    try {
        const report = db.prepare(`
            SELECT 
                r.*,
                u.email as reporter_email,
                u.full_name as reporter_name,
                u.phone as reporter_phone
            FROM crime_reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `).get(req.params.id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        if (report.evidence_files) {
            report.evidence_files = JSON.parse(report.evidence_files);
        }

        if (report.anonymous) {
            report.reporter_email = null;
            report.reporter_name = null;
            report.reporter_phone = null;
        }

        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report'
        });
    }
});

router.put('/:id', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'investigating', 'resolved', 'rejected'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const stmt = db.prepare(`
            UPDATE crime_reports 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        const result = stmt.run(status, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        res.json({
            success: true,
            message: 'Report status updated'
        });

    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update report'
        });
    }
});

router.get('/stats/summary', requireAdmin, (req, res) => {
    try {
        const totalReports = db.prepare('SELECT COUNT(*) as count FROM crime_reports').get();
        const pendingReports = db.prepare("SELECT COUNT(*) as count FROM crime_reports WHERE status = 'pending'").get();
        const resolvedReports = db.prepare("SELECT COUNT(*) as count FROM crime_reports WHERE status = 'resolved'").get();
        
        const byCategory = db.prepare(`
            SELECT category, COUNT(*) as count 
            FROM crime_reports 
            GROUP BY category 
            ORDER BY count DESC
        `).all();

        const byStatus = db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM crime_reports 
            GROUP BY status
        `).all();

        res.json({
            success: true,
            stats: {
                total: totalReports.count,
                pending: pendingReports.count,
                resolved: resolvedReports.count,
                byCategory,
                byStatus
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;