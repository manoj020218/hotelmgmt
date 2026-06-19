const admin = require('firebase-admin');

let firebaseInitialized = false;

function initFirebase() {
  const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    console.warn('[Firebase] Missing env vars — FCM push notifications disabled.');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: FIREBASE_CLIENT_EMAIL,
      }),
    });
    firebaseInitialized = true;
    console.log('[Firebase] FCM Admin SDK initialized.');
  } catch (err) {
    console.warn('[Firebase] Init failed — FCM disabled:', err.message);
  }
}

function getMessaging() {
  if (!firebaseInitialized) return null;
  return admin.messaging();
}

module.exports = { initFirebase, getMessaging };
