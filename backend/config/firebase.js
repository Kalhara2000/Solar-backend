// config/firebase.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL, // e.g., https://your-project.firebaseio.com
  });
}

// Auth & Database instances
const auth = admin.auth();
const db = admin.database();

// Test connection
db.ref(".info/connected").on("value", (snapshot) => {
  if (snapshot.val() === true) {
    console.log("🔥 Firebase Realtime Database Connected");
  } else {
    console.log("❌ Firebase Realtime Database Not Connected");
  }
});

// ✅ Export all needed modules
module.exports = { admin, auth, db };