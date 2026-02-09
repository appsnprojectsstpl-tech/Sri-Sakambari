const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to initialize with service account
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

// Get the backup folder from arguments
const backupFolder = process.argv[2];

if (!backupFolder) {
    console.error('❌ Please provide the path to the backup folder.');
    console.log('Usage: npm run restore -- backups/2026-02-09T03-00-00');
    process.exit(1);
}

const absoluteBackupPath = path.isAbsolute(backupFolder)
    ? backupFolder
    : path.join(__dirname, '..', backupFolder);

if (!fs.existsSync(absoluteBackupPath)) {
    console.error(`❌ Backup folder not found: ${absoluteBackupPath}`);
    process.exit(1);
}

async function restoreCollections() {
    const files = fs.readdirSync(absoluteBackupPath).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.error('❌ No JSON backup files found in the specified folder.');
        process.exit(1);
    }

    console.log(`🚀 Starting restoration from ${absoluteBackupPath}...`);
    console.log('⚠️  This will overwrite existing documents with the same IDs.\n');

    for (const file of files) {
        const collectionName = path.basename(file, '.json');
        const filePath = path.join(absoluteBackupPath, file);

        console.log(`📥 Restoring ${collectionName}...`);

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const docIds = Object.keys(data);

            if (docIds.length === 0) {
                console.log(`ℹ️  Collection ${collectionName} is empty, skipping.`);
                continue;
            }

            // Firestore batches are limited to 500 operations
            const BATCH_SIZE = 400;
            let count = 0;

            for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = docIds.slice(i, i + BATCH_SIZE);

                chunk.forEach(id => {
                    const docRef = db.collection(collectionName).doc(id);
                    batch.set(docRef, data[id]);
                    count++;
                });

                await batch.commit();
                console.log(`   Progres: ${count}/${docIds.length} documents restored...`);
            }

            console.log(`✅ ${collectionName} fully restored (${count} documents)`);
        } catch (error) {
            console.error(`❌ Error restoring ${collectionName}:`, error.message);
        }
    }

    console.log('\n🎉 Restoration complete!');
}

// Simple confirmation logic could be added here if needed, 
// but since this is manual execution, we assume the user knows what they are doing.
restoreCollections();
