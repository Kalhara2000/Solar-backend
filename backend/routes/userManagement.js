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

// ------------------- GET SINGLE USER -------------------
router.get("/:uid", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can view user details" });
  }

  const { uid } = req.params;

  try {
    // Get user from database
    const dbSnapshot = await db.ref(`users/${uid}`).once("value");
    const dbUser = dbSnapshot.val();

    // Get user from Firebase Auth
    let authUser;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch (authErr) {
      // If user not found in Auth but exists in DB, still return DB data
      if (authErr.code === 'auth/user-not-found' && dbUser) {
        return res.json({
          uid,
          name: dbUser.name || "",
          email: dbUser.email || "No email",
          role: dbUser.role || "user",
          cebId: dbUser.cebId || null,
          disabled: false,
          createdAt: dbUser.createdAt || null,
          lastSignIn: dbUser.lastLogin || null,
        });
      }
      throw authErr;
    }

    // Combine data
    const userData = {
      uid,
      name: dbUser?.name || authUser.displayName || "",
      email: authUser.email || dbUser?.email || "No email",
      role: dbUser?.role || "user",
      cebId: dbUser?.cebId || null,
      disabled: authUser.disabled || false,
      emailVerified: authUser.emailVerified || false,
      createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime).getTime() : (dbUser?.createdAt || null),
      lastSignIn: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).getTime() : (dbUser?.lastLogin || null),
      providers: authUser.providerData.map(p => p.providerId)
    };

    res.json(userData);
  } catch (err) {
    console.error("Fetch user error:", err);
    
    if (err.code === 'auth/user-not-found') {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ------------------- UPDATE USER -------------------
router.patch("/:uid", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can update users" });
  }

  const { uid } = req.params;
  const { name, role } = req.body;

  // Validate input
  if (!name && !role) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    // Update in Database
    const updates = {};
    if (name) updates.name = name.trim();
    if (role) updates.role = role;

    await db.ref(`users/${uid}`).update(updates);

    // Update in Firebase Auth if name is provided
    if (name) {
      try {
        await admin.auth().updateUser(uid, {
          displayName: name.trim()
        });
      } catch (authErr) {
        console.error("Failed to update Auth user:", authErr);
        // Don't fail the whole request if Auth update fails
        // Just log it and continue
      }
    }

    // Get updated user data
    const dbSnapshot = await db.ref(`users/${uid}`).once("value");
    const updatedDbUser = dbSnapshot.val();

    res.json({
      message: "User updated successfully",
      user: {
        uid,
        name: updatedDbUser?.name,
        role: updatedDbUser?.role,
        cebId: updatedDbUser?.cebId
      }
    });
  } catch (err) {
    console.error("Update user error:", err);
    
    if (err.code === 'auth/user-not-found') {
      return res.status(404).json({ error: "User not found in authentication" });
    }
    
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ------------------- DELETE USER -------------------
router.delete("/:uid", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can delete users" });
  }

  const { uid } = req.params;
  
  if (req.user.uid === uid) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    // Delete from Database
    await db.ref(`users/${uid}`).remove();
    
    // Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      console.error("Auth deletion error:", authErr);
      // If user doesn't exist in Auth but was in DB, still return success
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }
    
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;