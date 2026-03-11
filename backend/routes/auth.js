//backend/routes/auth.js

const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
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

    // 2. Save profile in database
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


// LOGIN - Verify Firebase ID token
router.post('/login', async (req, res) => {

  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      error: 'ID token is required'
    });
  }

  try {

    // 1. Verify Firebase ID Token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Get user profile
    const snapshot = await db.ref(`users/${uid}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return res.status(404).json({
        error: 'User profile not found'
      });
    }

    // 3. Update last login
    await db.ref(`users/${uid}`).update({
      lastLogin: Date.now()
    });

    res.json({
      message: "Login successful",
      user: {
        uid,
        cebId: userData.cebId,
        name: userData.name,
        role: userData.role
      }
    });

  } catch (error) {
    console.error('Login verification error:', error);

    res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
});


// Protected: Get own profile
router.get('/profile', authMiddleware, async (req, res) => {

  try {

    const snapshot = await db.ref(`users/${req.user.uid}`).once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    res.json(snapshot.val());

  } catch (err) {

    res.status(500).json({
      error: 'Failed to fetch profile'
    });

  }

});

module.exports = router;

// // PATCH unit status
// router.patch('/:unitId/status', authMiddleware, async (req, res) => {
//   const { unitId } = req.params;
//   const { status } = req.body;

//   try {
//     const unitRef = db.ref(`solarUnits/${unitId}`);
//     const snapshot = await unitRef.once('value');

//     if (!snapshot.exists()) {
//       return res.status(404).json({ error: 'Solar unit not found' });
//     }

//     await unitRef.update({ status, lastUpdated: Date.now() });

//     const updatedUnit = (await unitRef.once('value')).val();
//     res.json(updatedUnit);
//   } catch (err) {
//     console.error('Update status error:', err);
//     res.status(500).json({ error: 'Failed to update status' });
//   }
// });
