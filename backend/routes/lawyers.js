const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Get all lawyers with filters
router.get('/', (req, res) => {
    try {
        const { specialization, city, minRating, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT * FROM lawyers
            WHERE 1=1
        `;
        const params = [];

        if (specialization) {
            query += ' AND specialization = ?';
            params.push(specialization);
        }

        if (city) {
            query += ' AND city LIKE ?';
            params.push(`%${city}%`);
        }

        if (minRating) {
            query += ' AND rating >= ?';
            params.push(parseFloat(minRating));
        }

        if (search) {
            query += ' AND (full_name LIKE ? OR bio LIKE ? OR specialization LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY rating DESC, total_reviews DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const lawyers = db.prepare(query).all(...params);

        res.json({
            success: true,
            lawyers,
            total: lawyers.length
        });

    } catch (error) {
        console.error('Get lawyers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch lawyers'
        });
    }
});

// Get single lawyer by ID
router.get('/:id', (req, res) => {
    try {
        const lawyer = db.prepare('SELECT * FROM lawyers WHERE id = ?').get(req.params.id);

        if (!lawyer) {
            return res.status(404).json({
                success: false,
                message: 'Lawyer not found'
            });
        }

        // Get reviews for this lawyer
        const reviews = db.prepare(`
            SELECT 
                lr.*,
                u.full_name as user_name
            FROM lawyer_reviews lr
            JOIN users u ON lr.user_id = u.id
            WHERE lr.lawyer_id = ?
            ORDER BY lr.created_at DESC
            LIMIT 10
        `).all(req.params.id);

        res.json({
            success: true,
            lawyer,
            reviews
        });

    } catch (error) {
        console.error('Get lawyer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch lawyer details'
        });
    }
});

// Get all specializations
router.get('/meta/specializations', (req, res) => {
    try {
        const specializations = db.prepare(`
            SELECT DISTINCT specialization, COUNT(*) as count
            FROM lawyers
            GROUP BY specialization
            ORDER BY count DESC
        `).all();

        res.json({
            success: true,
            specializations
        });

    } catch (error) {
        console.error('Get specializations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specializations'
        });
    }
});

// Submit review for a lawyer
router.post('/:id/reviews', requireAuth, (req, res) => {
    try {
        const { rating, reviewText } = req.body;
        const lawyerId = req.params.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if lawyer exists
        const lawyer = db.prepare('SELECT id FROM lawyers WHERE id = ?').get(lawyerId);
        if (!lawyer) {
            return res.status(404).json({
                success: false,
                message: 'Lawyer not found'
            });
        }

        // Check if user already reviewed this lawyer
        const existingReview = db.prepare(
            'SELECT id FROM lawyer_reviews WHERE lawyer_id = ? AND user_id = ?'
        ).get(lawyerId, req.session.userId);

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this lawyer'
            });
        }

        // Insert review
        const stmt = db.prepare(`
            INSERT INTO lawyer_reviews (lawyer_id, user_id, rating, review_text)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(lawyerId, req.session.userId, rating, reviewText || null);

        // Update lawyer's average rating
        const avgRating = db.prepare(`
            SELECT AVG(rating) as avg, COUNT(*) as total
            FROM lawyer_reviews
            WHERE lawyer_id = ?
        `).get(lawyerId);

        db.prepare(`
            UPDATE lawyers 
            SET rating = ?, total_reviews = ?
            WHERE id = ?
        `).run(avgRating.avg, avgRating.total, lawyerId);

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully'
        });

    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit review'
        });
    }
});

// Request consultation
router.post('/:id/consultation', requireAuth, (req, res) => {
    try {
        const { caseType, description, preferredDate } = req.body;
        const lawyerId = req.params.id;

        if (!caseType || !description) {
            return res.status(400).json({
                success: false,
                message: 'Case type and description are required'
            });
        }

        // Check if lawyer exists
        const lawyer = db.prepare('SELECT id FROM lawyers WHERE id = ?').get(lawyerId);
        if (!lawyer) {
            return res.status(404).json({
                success: false,
                message: 'Lawyer not found'
            });
        }

        // Insert consultation request
        const stmt = db.prepare(`
            INSERT INTO consultation_requests 
            (user_id, lawyer_id, case_type, description, preferred_date, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `);

        const result = stmt.run(
            req.session.userId,
            lawyerId,
            caseType,
            description,
            preferredDate || null
        );

        res.status(201).json({
            success: true,
            message: 'Consultation request sent successfully',
            requestId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Consultation request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send consultation request'
        });
    }
});

// Get user's consultation requests
router.get('/user/consultations', requireAuth, (req, res) => {
    try {
        const consultations = db.prepare(`
            SELECT 
                cr.*,
                l.full_name as lawyer_name,
                l.specialization,
                l.phone as lawyer_phone,
                l.email as lawyer_email
            FROM consultation_requests cr
            JOIN lawyers l ON cr.lawyer_id = l.id
            WHERE cr.user_id = ?
            ORDER BY cr.created_at DESC
        `).all(req.session.userId);

        res.json({
            success: true,
            consultations
        });

    } catch (error) {
        console.error('Get consultations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch consultation requests'
        });
    }
});

module.exports = router;