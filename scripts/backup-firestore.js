const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to initialize with service account, fallback to default for local machine if logged in
try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Initialized with serviceAccountKey.json');
} catch (e) {
    try {
        // Read project ID from .firebaserc
        const firebaseRc = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8'));
        const projectId = firebaseRc.projects.default;

        admin.initializeApp({
            projectId: projectId
        });
        console.log(`✅ Initialized with project ID: ${projectId}`);
    } catch (err) {
        console.error('❌ Failed to initialize Firebase Admin. Please ensure serviceAccountKey.json exists in root or .firebaserc has a default project.');
        process.exit(1);
    }
}

const db = admin.firestore();

const collections = [
    'products',
    'categories',
    'users',
    'orders',
    'notifications',
    'orderCounters',
    'areas',
    'coupons',
    'subscriptions'
];

async function backupCollections() {
    const backupDir = path.join(__dirname, '../backups', new Date().toISOString().replace(/:/g, '-').split('.')[0]);

    if (!fs.existsSync(path.join(__dirname, '../backups'))) {
        fs.mkdirSync(path.join(__dirname, '../backups'));
    }
    fs.mkdirSync(backupDir);

    console.log(`🚀 Starting backup to ${backupDir}...`);

    for (const collectionName of collections) {
        console.log(`📦 Backing up ${collectionName}...`);
        try {
            const snapshot = await db.collection(collectionName).get();
            const data = {};

            snapshot.forEach(doc => {
                data[doc.id] = doc.data();
            });

            fs.writeFileSync(
                path.join(backupDir, `${collectionName}.json`),
                JSON.stringify(data, null, 2)
            );
            console.log(`✅ ${collectionName} backed up (${snapshot.size} documents)`);
        } catch (error) {
            console.error(`❌ Error backing up ${collectionName}:`, error.message);
        }
    }

    console.log('\n🎉 Backup complete!');
    console.log(`📁 Files saved in: ${backupDir}`);
}

backupCollections();
