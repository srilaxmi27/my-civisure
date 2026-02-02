const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../civisure.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS crime_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            location_lat REAL NOT NULL,
            location_lng REAL NOT NULL,
            location_address TEXT,
            date_time DATETIME NOT NULL,
            evidence_files TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'investigating', 'resolved', 'rejected')),
            anonymous BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            location_lat REAL NOT NULL,
            location_lng REAL NOT NULL,
            location_address TEXT,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'responded', 'resolved', 'false_alarm')),
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS chat_conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reports_status ON crime_reports(status);
        CREATE INDEX IF NOT EXISTS idx_reports_category ON crime_reports(category);
        CREATE INDEX IF NOT EXISTS idx_reports_created ON crime_reports(created_at);
        CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_alerts(status);
        CREATE INDEX IF NOT EXISTS idx_sos_created ON sos_alerts(created_at);
    `);

    console.log('Database initialized successfully!');
}

function insertDefaultUsers() {
    const bcrypt = require('bcryptjs');
    
    const users = [
        {
            email: 'admin@civisure.com',
            password: bcrypt.hashSync('admin123', 10),
            full_name: 'Admin User',
            phone: '1234567890',
            role: 'admin'
        },
        {
            email: 'user@civisure.com',
            password: bcrypt.hashSync('user123', 10),
            full_name: 'Test User',
            phone: '0987654321',
            role: 'user'
        }
    ];

    const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (email, password, full_name, phone, role)
        VALUES (?, ?, ?, ?, ?)
    `);

    users.forEach(user => {
        insertUser.run(user.email, user.password, user.full_name, user.phone, user.role);
    });

    console.log('Default users created!');
}

module.exports = {
    db,
    initializeDatabase,
    insertDefaultUsers
};