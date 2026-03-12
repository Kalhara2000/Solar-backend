//backend/routes/auth.js

const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');




// REGISTER - Create user with Firebase Auth + save profile in DB
router.post('/register', async (req, res) => {
  const { name, cebId, password, role = 'user' } = req.body;

  if (!name?.trim() || !cebId?.trim() || !password) {
    return res.status(400).json({
      error: 'Name, CEB ID and password are required'
    });
  }

  try {
    const fakeEmail = `${cebId.toLowerCase().trim()}@ceb.local`;

    // 1. Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: fakeEmail,
      password,
      displayName: name.trim()
    });

    // 2. Save profile
    await db.ref(`users/${userRecord.uid}`).set({
      name: name.trim(),
      cebId: cebId.toUpperCase().trim(),
      role,
      createdAt: Date.now(),
      lastLogin: null
    });

    res.status(201).json({
      message: 'Registration successful. Please login.',
      uid: userRecord.uid
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        error: 'This CEB ID is already registered'
      });
    }

    if (error.code === 'auth/invalid-password') {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    res.status(500).json({
      error: 'Registration failed. Try again later.'
    });
  }
});







// LOGIN - Frontend uses Firebase SDK, sends ID token → backend verifies & issues JWT
router.post('/login', async (req, res) => {
  const { idToken } = req.body; // ← Frontend must send Firebase ID token

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    // 1. Verify Firebase ID Token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Get user profile from DB
    const snapshot = await db.ref(`users/${uid}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // 3. Issue custom JWT (short-lived)
    const customToken = jwt.sign(
      {
        uid,
        cebId: userData.cebId,
        name: userData.name,
        role: userData.role
      },
      process.env.JWT_SECRET,
      // { expiresIn: 'never' } // for security 12h
    );


    // 4. Update last login
    await db.ref(`users/${uid}`).update({ lastLogin: Date.now() });

    res.json({
      token: customToken,
      user: {
        cebId: userData.cebId,
        name: userData.name,
        role: userData.role
      }
    });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Protected: Get own profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.ref(`users/${req.user.uid}`).once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(snapshot.val());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});


module.exports = router;