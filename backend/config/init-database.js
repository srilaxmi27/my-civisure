const { initializeDatabase, insertDefaultUsers } = require('./database');

console.log('Initializing CiviSure Database...\n');

try {
    initializeDatabase();
    insertDefaultUsers();
    console.log('\n✅ Database setup completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Admin - Email: admin@civisure.com, Password: admin123');
    console.log('User  - Email: user@civisure.com, Password: user123');
    process.exit(0);
} catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
}