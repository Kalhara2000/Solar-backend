const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
  // databaseURL: "https://ceb-solar-management-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const auth = admin.auth();
const db = admin.database();

module.exports = { auth, db };
