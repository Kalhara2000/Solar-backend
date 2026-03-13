// routes/userManagement.js
const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const authMiddleware = require("../middleware/auth");

// ------------------- GET ALL USERS -------------------
router.get("/", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Only admins can access user list" });

  try {
    const snapshot = await db.ref("users").once("value");
    const dbUsers = snapshot.val() || {};

    // 🔹 Get all Firebase Auth users
    let authUsers = [];
    let nextPageToken;
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      authUsers = authUsers.concat(result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    const authUsersMap = {};
    authUsers.forEach(user => {
      authUsersMap[user.uid] = {
        email: user.email,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : null,
        lastSignIn: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : null,
        displayName: user.displayName,
        providers: user.providerData.map(p => p.providerId)
      };
    });

    // Merge DB + Auth users
    const users = Object.keys(dbUsers).map(uid => {
      const dbUser = dbUsers[uid];
      const authUser = authUsersMap[uid];
      return {
        uid,
        name: dbUser.name || authUser?.displayName || "No name",
        email: authUser?.email || dbUser.email || "No email",
        role: dbUser.role || "user",
        cebId: dbUser.cebId || null,
        emailVerified: authUser?.emailVerified || false,
        disabled: authUser?.disabled || false,
        createdAt: authUser?.createdAt || dbUser.createdAt || Date.now(),
        lastSignIn: authUser?.lastSignIn || dbUser.lastLogin || null,
        providers: authUser?.providers || []
      };
    });

    // Add auth users not in DB
    authUsers.forEach(user => {
      if (!dbUsers[user.uid]) {
        users.push({
          uid: user.uid,
          name: user.displayName || "No name",
          email: user.email,
          role: "user",
          cebId: null,
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now(),
          lastSignIn: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : null,
          providers: user.providerData.map(p => p.providerId)
        });
      }
    });

    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ------------------- DELETE USER -------------------
router.delete("/:uid", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Only admins can delete users" });

  const { uid } = req.params;
  if (req.user.uid === uid) return res.status(400).json({ error: "Cannot delete own account" });

  try {
    await db.ref(`users/${uid}`).remove();
    await admin.auth().deleteUser(uid);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;