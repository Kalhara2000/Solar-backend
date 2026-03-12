// routes/userManagement.js

const express = require("express");
const router = express.Router();

const { admin, db } = require("../config/firebase");
const authMiddleware = require("../middleware/auth");


// Allowed roles
const allowedRoles = ["admin", "officer"];


// =======================================================
// GET ALL USERS (Admin only)
// =======================================================
router.get("/", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Only admins can access user list"
    });
  }

  try {

    const snapshot = await db.ref("users").once("value");

    const usersObj = snapshot.val() || {};

    const users = Object.keys(usersObj).map((uid) => ({
      uid,
      ...usersObj[uid]
    }));

    res.json(users);

  } catch (err) {

    console.error("Fetch users error:", err);

    res.status(500).json({
      error: "Failed to fetch users"
    });

  }

});


// =======================================================
// GET USER BY ID
// =======================================================
router.get("/:uid", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Only admins can access user details"
    });
  }

  const { uid } = req.params;

  try {

    const snapshot = await db.ref(`users/${uid}`).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const userData = snapshot.val();

    try {

      const authUser = await admin.auth().getUser(uid);

      userData.emailVerified = authUser.emailVerified;
      userData.disabled = authUser.disabled;

    } catch (authErr) {

      console.log("Auth user not found:", authErr.message);

    }

    res.json(userData);

  } catch (err) {

    console.error("Fetch user error:", err);

    res.status(500).json({
      error: "Failed to fetch user"
    });

  }

});


// =======================================================
// ADD NEW USER
// =======================================================
router.post("/", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Only admins can add users"
    });
  }

  const { email, password, name, role, cebId } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({
      error: "Email, password, name, and role are required"
    });
  }

  if (!email.includes("@")) {
    return res.status(400).json({
      error: "Invalid email address"
    });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      error: "Invalid role"
    });
  }

  try {

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: email.trim(),
      password,
      displayName: name.trim()
    });

    // Set role
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // Save in database
    await db.ref(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      name: name.trim(),
      email: email.trim(),
      role,
      cebId: cebId || null,
      createdAt: Date.now()
    });

    res.status(201).json({
      message: "User added successfully",
      uid: userRecord.uid
    });

  } catch (err) {

    console.error("Add user error:", err);

    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({
        error: "Email already exists"
      });
    }

    res.status(500).json({
      error: err.message || "Failed to add user"
    });

  }

});


// =======================================================
// UPDATE USER
// =======================================================
router.patch("/:uid", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Only admins can edit users"
    });
  }

  const { uid } = req.params;
  const { name, email, role, cebId, password } = req.body;

  try {

    const userRef = db.ref(`users/${uid}`);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const authUpdateData = {};

    if (name) authUpdateData.displayName = name.trim();
    if (email) authUpdateData.email = email.trim();
    if (password) authUpdateData.password = password;

    if (Object.keys(authUpdateData).length > 0) {
      await admin.auth().updateUser(uid, authUpdateData);
    }

    if (role) {

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          error: "Invalid role"
        });
      }

      await admin.auth().setCustomUserClaims(uid, { role });

    }

    const updateData = {};

    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim();
    if (role) updateData.role = role;
    if (cebId !== undefined) updateData.cebId = cebId;

    updateData.updatedAt = Date.now();

    await userRef.update(updateData);

    res.json({
      message: "User updated successfully"
    });

  } catch (err) {

    console.error("Update user error:", err);

    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({
        error: "Email already exists"
      });
    }

    res.status(500).json({
      error: err.message || "Failed to update user"
    });

  }

});


// =======================================================
// DELETE USER
// =======================================================
router.delete("/:uid", authMiddleware, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Only admins can delete users"
    });
  }

  const { uid } = req.params;

  if (req.user.uid === uid) {
    return res.status(400).json({
      error: "Admin cannot delete their own account"
    });
  }

  try {

    const snapshot = await db.ref(`users/${uid}`).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    await db.ref(`users/${uid}`).remove();

    await admin.auth().deleteUser(uid);

    res.json({
      message: "User deleted successfully"
    });

  } catch (err) {

    console.error("Delete user error:", err);

    res.status(500).json({
      error: err.message || "Failed to delete user"
    });

  }

});


module.exports = router;