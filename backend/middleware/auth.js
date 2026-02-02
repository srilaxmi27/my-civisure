function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
}

function optionalAuth(req, res, next) {
    if (req.session && req.session.userId) {
        req.isAuthenticated = true;
        req.userId = req.session.userId;
        req.userRole = req.session.role;
    } else {
        req.isAuthenticated = false;
    }
    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    optionalAuth
};