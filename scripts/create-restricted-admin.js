/**
 * Script to create a restricted admin user
 * Email: admin123@gmail.com
 * Password: 123456789
 * Role: restricted_admin
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const auth = admin.auth();
const firestore = admin.firestore();

async function createRestrictedAdmin() {
    try {
        // Create authentication user
        const userRecord = await auth.createUser({
            email: 'admin123@gmail.com',
            password: '123456789',
            displayName: 'Restricted Admin',
            emailVerified: true
        });

        console.log('✅ Created auth user:', userRecord.uid);

        // Create Firestore user document
        await firestore.collection('users').doc(userRecord.uid).set({
            id: userRecord.uid,
            email: 'admin123@gmail.com',
            name: 'Restricted Admin',
            phone: '+919999999999', // Placeholder phone
            role: 'restricted_admin',
            address: 'Admin Office',
            area: 'Central',
            landmark: 'Main Office',
            pincode: '500001',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });

        console.log('✅ Created Firestore user document');
        console.log('\n🎉 Restricted Admin user created successfully!');
        console.log('Email: admin123@gmail.com');
        console.log('Password: 123456789');
        console.log('Role: restricted_admin');
        console.log('\nThis user will only have access to:');
        console.log('  - Orders tab');
        console.log('  - Products tab');
        console.log('  - WhatsApp tab');

    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            console.log('⚠️  User already exists. Updating role to restricted_admin...');

            // Get existing user
            const userRecord = await auth.getUserByEmail('admin123@gmail.com');

            // Update Firestore document
            await firestore.collection('users').doc(userRecord.uid).update({
                role: 'restricted_admin'
            });

            console.log('✅ Updated user role to restricted_admin');
        } else {
            console.error('❌ Error creating user:', error);
        }
    } finally {
        process.exit(0);
    }
}

createRestrictedAdmin();
