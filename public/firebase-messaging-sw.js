importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyDkc0PYc4OAH2-NUnGlkrrwRruo8r8EQY8",
    authDomain: "studio-1474537647-7252f.firebaseapp.com",
    projectId: "studio-1474537647-7252f",
    storageBucket: "studio-1474537647-7252f.appspot.com",
    messagingSenderId: "354300085126",
    appId: "1:354300085126:web:ba55c4d44b87273578e207",
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
