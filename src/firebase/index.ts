
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, type Firestore, collection, addDoc } from 'firebase/firestore';
import { getMessaging, type Messaging, isSupported } from 'firebase/messaging';

import { firebaseConfig } from './config';
import type { User, Role } from '@/lib/types';

// Export hooks from their source files
export { FirebaseClientProvider } from './client-provider';
export { useFirebaseApp, useAuth, useFirestore, useMemoFirebase } from './provider';
export { useUser } from './auth/use-user';
export { useDoc } from './firestore/use-doc';
export { useCollection } from './firestore/use-collection';


import { getStorage, type FirebaseStorage } from 'firebase/storage';

function initializeFirebase() {
    const apps = getApps();
    const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    const storage = getStorage(app);
    let messaging: Messaging | null = null;

    if (typeof window !== 'undefined') {
        isSupported().then(supported => {
            if (supported) {
                messaging = getMessaging(app);
            }
        });
    }

    return { app, auth, firestore, storage, messaging };
}

interface CreateUserDto {
    email?: string; // Optional - will auto-generate if not provided
    password?: string;
    name: string;
    phone: string;
    address: string;
    area: string;
    pincode: string;
    landmark?: string;
    role: Role;
}

// Helper function to generate internal email for name-only accounts
function generateInternalEmail(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const timestamp = Date.now();
    return `${sanitized}_${timestamp}@sakambari.local`;
}

// Function to create a user in Auth and Firestore
async function createUser(auth: Auth, firestore: Firestore, userData: CreateUserDto) {
    if (!userData.password) {
        throw new Error("Password is required for email/password accounts.");
    }

    // Generate internal email if not provided
    const authEmail = userData.email || generateInternalEmail(userData.name);

    // 1. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, authEmail, userData.password);
    const user = userCredential.user;

    try {
        // 2. Create Firestore Profile
        const userDocRef = doc(firestore, 'users', user.uid);
        const { password, ...firestoreData } = userData;

        const newUser: Omit<User, 'id' | 'createdAt'> = {
            ...firestoreData,
            email: firestoreData.email || '',
            phone: firestoreData.phone || '',
            pincode: firestoreData.pincode || '',
            landmark: firestoreData.landmark || '',
            addresses: [{
                id: 'addr_' + Date.now().toString(),
                label: 'Home',
                line1: firestoreData.address,
                area: firestoreData.area,
                pincode: firestoreData.pincode || '',
                landmark: firestoreData.landmark || '',
                isDefault: true
            }]
        };

        await setDoc(userDocRef, {
            ...newUser,
            id: user.uid,
            authEmail: authEmail,
            createdAt: serverTimestamp()
        });

        if (userData.role === 'admin') {
            const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
            await setDoc(adminRoleRef, { assignedAt: serverTimestamp() });
        }

        return user;

    } catch (error) {
        // 3. Rollback: Delete Auth User if Firestore fails
        console.error("Firestore Profile Creation Failed. Rolling back Auth User.", error);
        try {
            await user.delete();
            console.log("Rolled back Auth User successfully.");
        } catch (deleteErr) {
            console.error("CRITICAL: Failed to rollback Auth User (Ghost Account Created)", deleteErr);
        }
        throw error; // Re-throw original error to UI
    }
}


async function createNotification(firestore: Firestore, userId: string, title: string, message: string) {
    const notificationsCollection = collection(firestore, 'notifications');
    await addDoc(notificationsCollection, {
        userId,
        title,
        message,
        isRead: false,
        createdAt: serverTimestamp()
    });
}


const { storage, auth, firestore } = initializeFirebase();
export { storage, auth, firestore };

export { initializeFirebase, createUser, createNotification };
