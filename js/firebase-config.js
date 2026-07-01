/*
  ╔══════════════════════════════════════════════════════════════╗
  ║  FIREBASE SETUP — One-time, 5-minute process                ║
  ╚══════════════════════════════════════════════════════════════╝

  To enable cloud sync and login:

  1. Go to https://console.firebase.google.com
  2. Click "Add project" → name it (e.g. "another-day-journal")
  3. Disable Google Analytics (not needed) → Create project

  4. Add a Web App:
     - Click the </> icon
     - Nickname: "journal-web"
     - Click "Register app"
     - Copy the firebaseConfig object shown and paste it below
     - Click "Continue to console"

  5. Enable Authentication:
     - Left sidebar → Build → Authentication → Get started
     - Sign-in method tab → Enable "Google"
     - Also enable "Email/Password" if you want email login
     - Save

  6. Create Firestore Database:
     - Left sidebar → Build → Firestore Database → Create database
     - Start in "production mode" → Next
     - Choose a location closest to you → Done

  7. Set Firestore Security Rules:
     - In Firestore → Rules tab → paste this:

       rules_version = '2';
       service cloud.firestore {
         match /databases/{database}/documents {
           match /users/{userId}/{document=**} {
             allow read, write: if request.auth != null && request.auth.uid == userId;
           }
         }
       }

     - Click Publish

  8. Paste your config below, replacing the placeholder values.
*/

const FIREBASE_CONFIG = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId:         "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE",
};

// Set to true once you've filled in the config above
const FIREBASE_ENABLED = false;

window.FIREBASE_CONFIG   = FIREBASE_CONFIG;
window.FIREBASE_ENABLED  = FIREBASE_ENABLED;
