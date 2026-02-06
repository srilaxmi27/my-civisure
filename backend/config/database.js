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
    // Lawyers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS lawyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            specialization TEXT NOT NULL,
            experience_years INTEGER NOT NULL,
            education TEXT NOT NULL,
            bar_registration TEXT NOT NULL,
            office_address TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            profile_image TEXT,
            bio TEXT,
            languages TEXT,
            rating REAL DEFAULT 0.0,
            total_reviews INTEGER DEFAULT 0,
            consultation_fee REAL,
            availability TEXT DEFAULT 'Available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Lawyer reviews table
    db.exec(`
        CREATE TABLE IF NOT EXISTS lawyer_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lawyer_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            review_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lawyer_id) REFERENCES lawyers(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Consultation requests table
    db.exec(`
        CREATE TABLE IF NOT EXISTS consultation_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lawyer_id INTEGER NOT NULL,
            case_type TEXT NOT NULL,
            description TEXT NOT NULL,
            preferred_date DATETIME,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (lawyer_id) REFERENCES lawyers(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reports_status ON crime_reports(status);
        CREATE INDEX IF NOT EXISTS idx_reports_category ON crime_reports(category);
        CREATE INDEX IF NOT EXISTS idx_reports_created ON crime_reports(created_at);
        CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_alerts(status);
        CREATE INDEX IF NOT EXISTS idx_sos_created ON sos_alerts(created_at);
        CREATE INDEX IF NOT EXISTS idx_lawyers_specialization ON lawyers(specialization);
        CREATE INDEX IF NOT EXISTS idx_lawyers_city ON lawyers(city);
        CREATE INDEX IF NOT EXISTS idx_lawyer_reviews_lawyer ON lawyer_reviews(lawyer_id);
        CREATE INDEX IF NOT EXISTS idx_consultation_requests_user ON consultation_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_consultation_requests_lawyer ON consultation_requests(lawyer_id);
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
    // Insert sample lawyers (for testing)
function insertSampleLawyers() {
    const lawyers = [
        {
            full_name: 'Advocate Rajesh Kumar',
            email: 'rajesh.kumar@lawfirm.com',
            phone: '+91-9876543210',
            specialization: 'Criminal Law',
            experience_years: 15,
            education: 'LLB from Delhi University, LLM from Harvard Law School',
            bar_registration: 'BAR/2008/DL/12345',
            office_address: '123 Supreme Court Complex, Connaught Place',
            city: 'New Delhi',
            state: 'Delhi',
            bio: 'Specialized in criminal defense with over 15 years of experience. Successfully defended numerous high-profile cases.',
            languages: 'English, Hindi, Punjabi',
            rating: 4.8,
            total_reviews: 45,
            consultation_fee: 5000,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Priya Sharma',
            email: 'priya.sharma@legalaid.com',
            phone: '+91-9876543211',
            specialization: 'Domestic Violence',
            experience_years: 10,
            education: 'LLB from Mumbai University, Specialized in Family Law',
            bar_registration: 'BAR/2013/MH/67890',
            office_address: '456 Legal Complex, Bandra West',
            city: 'Mumbai',
            state: 'Maharashtra',
            bio: 'Dedicated to protecting victims of domestic violence. Providing compassionate legal support and representation.',
            languages: 'English, Hindi, Marathi',
            rating: 4.9,
            total_reviews: 67,
            consultation_fee: 3000,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Anil Verma',
            email: 'anil.verma@govtlegal.com',
            phone: '+91-9876543212',
            specialization: 'Government Cases',
            experience_years: 20,
            education: 'LLB, LLM in Constitutional Law from National Law School',
            bar_registration: 'BAR/2003/KA/11223',
            office_address: '789 High Court Road, MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            bio: 'Expert in constitutional law and government litigation. Extensive experience in public interest litigation.',
            languages: 'English, Hindi, Kannada',
            rating: 4.7,
            total_reviews: 89,
            consultation_fee: 7000,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Sunita Reddy',
            email: 'sunita.reddy@cyberlegal.com',
            phone: '+91-9876543213',
            specialization: 'Cyber Crime',
            experience_years: 8,
            education: 'LLB, Specialized in Cyber Law and IT Act',
            bar_registration: 'BAR/2015/TG/33445',
            office_address: '321 Cyber Towers, Hitech City',
            city: 'Hyderabad',
            state: 'Telangana',
            bio: 'Specialized in cyber crimes, data breaches, and online fraud cases. Tech-savvy lawyer with proven track record.',
            languages: 'English, Hindi, Telugu',
            rating: 4.6,
            total_reviews: 34,
            consultation_fee: 4000,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Vikram Singh',
            email: 'vikram.singh@propertylegal.com',
            phone: '+91-9876543214',
            specialization: 'Property Disputes',
            experience_years: 18,
            education: 'LLB from Allahabad University, LLM in Property Law',
            bar_registration: 'BAR/2005/UP/55667',
            office_address: '567 Civil Lines, Near High Court',
            city: 'Lucknow',
            state: 'Uttar Pradesh',
            bio: 'Expert in property disputes, land acquisition, and real estate law. Successfully resolved hundreds of property cases.',
            languages: 'English, Hindi',
            rating: 4.5,
            total_reviews: 56,
            consultation_fee: 4500,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Meera Patel',
            email: 'meera.patel@consumerlegal.com',
            phone: '+91-9876543215',
            specialization: 'Consumer Rights',
            experience_years: 12,
            education: 'LLB, Specialized in Consumer Protection Act',
            bar_registration: 'BAR/2011/GJ/77889',
            office_address: '890 Consumer Forum Road, Ashram Road',
            city: 'Ahmedabad',
            state: 'Gujarat',
            bio: 'Passionate about consumer rights and protection. Helped thousands get justice against unfair trade practices.',
            languages: 'English, Hindi, Gujarati',
            rating: 4.8,
            total_reviews: 78,
            consultation_fee: 2500,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Ramesh Iyer',
            email: 'ramesh.iyer@corporatelegal.com',
            phone: '+91-9876543216',
            specialization: 'Corporate Law',
            experience_years: 22,
            education: 'LLB, LLM in Corporate Law from ILS Pune',
            bar_registration: 'BAR/2001/MH/99001',
            office_address: '234 Business District, Nariman Point',
            city: 'Mumbai',
            state: 'Maharashtra',
            bio: 'Senior corporate lawyer with expertise in mergers, acquisitions, and business contracts. Advised numerous Fortune 500 companies.',
            languages: 'English, Hindi, Tamil',
            rating: 4.9,
            total_reviews: 112,
            consultation_fee: 10000,
            availability: 'Busy - Limited slots'
        },
        {
            full_name: 'Advocate Kavita Desai',
            email: 'kavita.desai@familylegal.com',
            phone: '+91-9876543217',
            specialization: 'Family Law',
            experience_years: 14,
            education: 'LLB, Specialized in Family Court Procedures',
            bar_registration: 'BAR/2009/KA/22334',
            office_address: '678 Family Court Complex, Koramangala',
            city: 'Bangalore',
            state: 'Karnataka',
            bio: 'Compassionate family lawyer handling divorce, custody, and inheritance cases with sensitivity and professionalism.',
            languages: 'English, Hindi, Kannada, Tamil',
            rating: 4.7,
            total_reviews: 91,
            consultation_fee: 3500,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Arjun Malhotra',
            email: 'arjun.malhotra@taxlegal.com',
            phone: '+91-9876543218',
            specialization: 'Tax Law',
            experience_years: 16,
            education: 'LLB, Chartered Accountant, LLM in Tax Law',
            bar_registration: 'BAR/2007/DL/44556',
            office_address: '345 Tax Plaza, Nehru Place',
            city: 'New Delhi',
            state: 'Delhi',
            bio: 'Expert in income tax, GST, and corporate taxation. Helped numerous businesses with tax compliance and disputes.',
            languages: 'English, Hindi',
            rating: 4.6,
            total_reviews: 67,
            consultation_fee: 6000,
            availability: 'Available'
        },
        {
            full_name: 'Advocate Sanjana Roy',
            email: 'sanjana.roy@labourlegal.com',
            phone: '+91-9876543219',
            specialization: 'Labour Law',
            experience_years: 11,
            education: 'LLB, Specialized in Industrial Relations and Labour Laws',
            bar_registration: 'BAR/2012/WB/66778',
            office_address: '789 Labour Court Road, Salt Lake',
            city: 'Kolkata',
            state: 'West Bengal',
            bio: 'Advocate for workers\' rights and employment disputes. Strong track record in wrongful termination and wage cases.',
            languages: 'English, Hindi, Bengali',
            rating: 4.8,
            total_reviews: 53,
            consultation_fee: 3000,
            availability: 'Available'
        }
    ];

    const insertLawyer = db.prepare(`
        INSERT OR IGNORE INTO lawyers 
        (full_name, email, phone, specialization, experience_years, education, 
         bar_registration, office_address, city, state, bio, languages, 
         rating, total_reviews, consultation_fee, availability)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    lawyers.forEach(lawyer => {
        insertLawyer.run(
            lawyer.full_name,
            lawyer.email,
            lawyer.phone,
            lawyer.specialization,
            lawyer.experience_years,
            lawyer.education,
            lawyer.bar_registration,
            lawyer.office_address,
            lawyer.city,
            lawyer.state,
            lawyer.bio,
            lawyer.languages,
            lawyer.rating,
            lawyer.total_reviews,
            lawyer.consultation_fee,
            lawyer.availability
        );
    });

    console.log('Sample lawyers added!');
}

module.exports = {
    db,
    initializeDatabase,
    insertDefaultUsers,
    insertSampleLawyers
};