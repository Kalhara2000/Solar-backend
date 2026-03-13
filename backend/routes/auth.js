// routes/auth.js
const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// ------------------- REGISTER -------------------
router.post('/register', async (req, res) => {
  const { name, cebId, password, role = 'user' } = req.body;

  if (!name?.trim() || !cebId?.trim() || !password)
    return res.status(400).json({ error: 'Name, CEB ID and password are required' });

  try {
    const fakeEmail = `${cebId.toLowerCase().trim()}@ceb.local`;

    const userRecord = await auth.createUser({
      email: fakeEmail,
      password,
      displayName: name.trim()
    });

    await db.ref(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      name: name.trim(),
      cebId: cebId.toUpperCase().trim(),
      role,
      createdAt: Date.now(),
      lastLogin: null
    });

    res.status(201).json({ message: 'Registration successful. Please login.', uid: userRecord.uid });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'This CEB ID is already registered' });
    if (error.code === 'auth/invalid-password') return res.status(400).json({ error: 'Password must be at least 6 characters' });
    res.status(500).json({ error: 'Registration failed. Try again later.' });
  }
});

// ------------------- LOGIN -------------------
router.post('/login', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) return res.status(400).json({ error: 'ID token is required' });

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const snapshot = await db.ref(`users/${uid}`).once('value');
    const userData = snapshot.val();
    if (!userData) return res.status(404).json({ error: 'User profile not found' });

    // 🔹 Backend JWT for frontend
    const token = jwt.sign({ uid, cebId: userData.cebId, name: userData.name, role: userData.role }, process.env.JWT_SECRET, { expiresIn: '8h' });

    await db.ref(`users/${uid}`).update({ lastLogin: Date.now() });

    res.json({ token, user: { uid, name: userData.name, role: userData.role, cebId: userData.cebId } });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(401).json({ error: 'Invalid or expired Firebase token' });
  }
});

// ------------------- GET PROFILE -------------------
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.ref(`users/${req.user.uid}`).once('value');
    if (!snapshot.exists()) return res.status(404).json({ error: 'Profile not found' });
    res.json(snapshot.val());
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;