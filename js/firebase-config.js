/**
 * Firebase Configuration
 * ======================
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Add a Web app (</> icon) and copy the config object
 * 4. Replace the placeholder values below with your config
 * 5. Enable Authentication > Sign-in method > Email/Password
 * 6. Create Firestore Database (start in production mode)
 * 7. Deploy firestore.rules from this project
 * 8. (Optional) Enable Firebase Storage for gallery uploads
 * 9. Create an admin user in Authentication > Users
 *
 * Collections used:
 *   settings, news, specializations, applications, comments, gallery
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCcoG5OSey1uB16hnsEP5NQ1b2Z78K679k",
  authDomain: "college-doni.firebaseapp.com",
  projectId: "college-doni",
  storageBucket: "college-doni.firebasestorage.app",
  messagingSenderId: "575053135113",
  appId: "1:575053135113:web:56c605cfe15df3278f67d8",
  measurementId: "G-G04VKV1D77"
};
export const COLLECTIONS = {
  SETTINGS: 'settings',
  NEWS: 'news',
  SPECIALIZATIONS: 'specializations',
  APPLICATIONS: 'applications',
  COMMENTS: 'comments',
  GALLERY: 'gallery'
};

export const SETTINGS_DOC_ID = 'site';
