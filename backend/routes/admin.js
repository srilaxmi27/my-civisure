const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

router.get('/dashboard', requireAdmin, (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "user"').get();
        const totalReports = db.prepare('SELECT COUNT(*) as count FROM crime_reports').get();
        const pendingReports = db.prepare('SELECT COUNT(*) as count FROM crime_reports WHERE status = "pending"').get();
        const activeSOS = db.prepare('SELECT COUNT(*) as count FROM sos_alerts WHERE status = "active"').get();

        const recentReports = db.prepare(`
            SELECT id, category, location_address, status, created_at
            FROM crime_reports
            ORDER BY created_at DESC
            LIMIT 5
        `).all();

        const reportsByCategory = db.prepare(`
            SELECT category, COUNT(*) as count
            FROM crime_reports
            GROUP BY category
            ORDER BY count DESC
        `).all();

        const reportsByStatus = db.prepare(`
            SELECT status, COUNT(*) as count
            FROM crime_reports
            GROUP BY status
        `).all();

        const recentActivity = db.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM crime_reports
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all();

        res.json({
            success: true,
            dashboard: {
                counts: {
                    totalUsers: totalUsers.count,
                    totalReports: totalReports.count,
                    pendingReports: pendingReports.count,
                    activeSOS: activeSOS.count
                },
                recentReports,
                reportsByCategory,
                reportsByStatus,
                recentActivity
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data'
        });
    }
});

router.get('/users', requireAdmin, (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const users = db.prepare(`
            SELECT 
                id, email, full_name, phone, role, created_at, last_login
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();

        res.json({
            success: true,
            users,
            total: totalUsers.count
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

router.put('/users/:id/role', requireAdmin, (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['user', 'admin'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        if (parseInt(req.params.id) === req.session.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
        const result = stmt.run(role, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User role updated'
        });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user role'
        });
    }
});

router.get('/analytics', requireAdmin, (req, res) => {
    try {
        const { period = '30' } = req.query;

        const crimeTrends = db.prepare(`
            SELECT 
                DATE(created_at) as date,
                category,
                COUNT(*) as count
            FROM crime_reports
            WHERE created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY DATE(created_at), category
            ORDER BY date
        `).all(parseInt(period));

        const topLocations = db.prepare(`
            SELECT 
                location_address,
                COUNT(*) as count,
                AVG(location_lat) as lat,
                AVG(location_lng) as lng
            FROM crime_reports
            WHERE location_address IS NOT NULL
            GROUP BY location_address
            ORDER BY count DESC
            LIMIT 10
        `).all();

        const responseTimeAnalysis = db.prepare(`
            SELECT 
                category,
                AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avg_days,
                COUNT(*) as count
            FROM crime_reports
            WHERE status = 'resolved'
            GROUP BY category
        `).all();

        const sosStats = db.prepare(`
            SELECT 
                status,
                COUNT(*) as count,
                AVG(JULIANDAY(resolved_at) - JULIANDAY(created_at)) * 24 * 60 as avg_response_minutes
            FROM sos_alerts
            WHERE created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY status
        `).all(parseInt(period));

        res.json({
            success: true,
            analytics: {
                crimeTrends,
                topLocations,
                responseTimeAnalysis,
                sosStats
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics'
        });
    }
});

router.get('/export/reports', requireAdmin, (req, res) => {
    try {
        const { status, category, startDate, endDate } = req.query;

        let query = 'SELECT * FROM crime_reports WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY created_at DESC';

        const reports = db.prepare(query).all(...params);

        const headers = ['ID', 'Category', 'Description', 'Location', 'Date/Time', 'Status', 'Created At'];
        const csvRows = [headers.join(',')];

        reports.forEach(report => {
            const row = [
                report.id,
                `"${report.category}"`,
                `"${report.description.replace(/"/g, '""')}"`,
                `"${report.location_address || 'N/A'}"`,
                report.date_time,
                report.status,
                report.created_at
            ];
            csvRows.push(row.join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=crime_reports.csv');
        res.send(csv);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export reports'
        });
    }
});

module.exports = router;