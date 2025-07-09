import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Log the actual configuration being used
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + '...' : 'UNDEFINED',
  authDomain: firebaseConfig.authDomain || 'UNDEFINED',
  projectId: firebaseConfig.projectId || 'UNDEFINED',
  storageBucket: firebaseConfig.storageBucket || 'UNDEFINED',
  messagingSenderId: firebaseConfig.messagingSenderId || 'UNDEFINED',
  appId: firebaseConfig.appId ? firebaseConfig.appId.substring(0, 10) + '...' : 'UNDEFINED'
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;