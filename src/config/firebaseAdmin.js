const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseApp = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let serviceAccount;
    const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (rawEnv.startsWith('{')) {
      serviceAccount = JSON.parse(rawEnv);
    } else {
      const decoded = Buffer.from(rawEnv, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    }

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('[FirebaseAdmin] Inicializado correctamente con Service Account');
  } else {
    console.warn('[FirebaseAdmin] Advertencia: FIREBASE_SERVICE_ACCOUNT no está definida en las variables de entorno.');
  }
} catch (error) {
  console.error('[FirebaseAdmin] Error al inicializar Firebase Admin:', error.message);
}

module.exports = {
  firebaseApp,
  messaging: () => (firebaseApp ? getMessaging(firebaseApp) : null),
};
