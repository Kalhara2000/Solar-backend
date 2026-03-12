// config/firebase.js

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
});

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

module.exports = { auth, db };
