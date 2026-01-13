
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
export { useInfiniteCollection } from './firestore/use-infinite-collection';
export { fetchCollection } from './firestore/fetch-collection';


function initializeFirebase() {
    const apps = getApps();
    const app = apps.length ? apps[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    let messaging: Messaging | null = null;

    if (typeof window !== 'undefined') {
        isSupported().then(supported => {
            if (supported) {
                messaging = getMessaging(app);
            }
        });
    }

    return { app, auth, firestore, messaging };
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
    const userCredential = await createUserWithEmailAndPassword(auth, authEmail, userData.password);
    const user = userCredential.user;

    const userDocRef = doc(firestore, 'users', user.uid);
    const { password, ...firestoreData } = userData;

    const newUser: Omit<User, 'id' | 'createdAt'> = {
        ...firestoreData,
        email: firestoreData.email || '', // Store actual email (empty if not provided)
        phone: firestoreData.phone || '', // Ensure phone is not undefined
        pincode: firestoreData.pincode || '', // Ensure pincode is not undefined
        landmark: firestoreData.landmark || '', // Ensure landmark is not undefined
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
        authEmail: authEmail, // Store the email used for Firebase Auth (for name-based login)
        createdAt: serverTimestamp()
    });

    // If the user is an admin, add them to the roles_admin collection
    if (userData.role === 'admin') {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        await setDoc(adminRoleRef, { assignedAt: serverTimestamp() });
    }

    return user;
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


export { initializeFirebase, createUser, createNotification };
