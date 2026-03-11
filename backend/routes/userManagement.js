const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
// const { admin } = require('../config/firebase-admin'); // Add this
const authMiddleware = require('../middleware/auth');

// =============================
// GET ALL USERS (Admin only)
// =============================
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can access user list' });
  }

  try {
    const snapshot = await db.ref('users').once('value');
    const usersObj = snapshot.val() || {};
    const users = Object.values(usersObj);
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// =============================
// ADD NEW USER (Admin only)
// =============================
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can add users' });
  }

  const { email, password, name, role, cebId } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Email, password, name, and role are required' });
  }

  try {
    // 1. Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Set custom claims for role
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // 3. Save user details in Realtime Database
    const userRef = db.ref(`users/${userRecord.uid}`);
    await userRef.set({
      uid: userRecord.uid,
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      cebId: cebId || null,
      createdAt: Date.now(),
    });

    res.status(201).json({ 
      message: 'User added successfully', 
      uid: userRecord.uid 
    });
  } catch (err) {
    console.error('Add user error:', err);
    
    // Handle specific Firebase Auth errors
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: err.message || 'Failed to add user' });
  }
});

// =============================
// UPDATE USER (Admin only)
// =============================
router.patch('/:uid', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can edit users' });
  }

  const { uid } = req.params;
  const { name, email, role, cebId, password } = req.body;

  try {
    // Check if user exists in database
    const userRef = db.ref(`users/${uid}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update Firebase Authentication
    const authUpdateData = {};
    if (name !== undefined) authUpdateData.displayName = name.trim();
    if (email !== undefined) authUpdateData.email = email.trim();
    if (password !== undefined) authUpdateData.password = password;
    
    if (Object.keys(authUpdateData).length > 0) {
      await admin.auth().updateUser(uid, authUpdateData);
    }

    // Update custom claims if role changed
    if (role !== undefined) {
      await admin.auth().setCustomUserClaims(uid, { role });
    }

    // Update Realtime Database
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (role !== undefined) updateData.role = role.trim();
    if (cebId !== undefined) updateData.cebId = cebId;

    await userRef.update(updateData);

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

// =============================
// DELETE USER (Admin only)
// =============================
router.delete('/:uid', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete users' });
  }

  const { uid } = req.params;

  try {
    // Check if user exists in database
    const userRef = db.ref(`users/${uid}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete from Realtime Database
    await userRef.remove();

    // Delete from Firebase Authentication
    await admin.auth().deleteUser(uid);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
});

// =============================
// GET USER BY ID (Admin only)
// =============================
router.get('/:uid', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can access user details' });
  }

  const { uid } = req.params;

  try {
    // Get from Realtime Database
    const userRef = db.ref(`users/${uid}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = snapshot.val();
    
    // Optionally get additional data from Auth
    try {
      const authUser = await admin.auth().getUser(uid);
      userData.emailVerified = authUser.emailVerified;
      userData.disabled = authUser.disabled;
    } catch (authErr) {
      console.log('Auth user not found:', authErr.message);
    }

    res.json(userData);
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;