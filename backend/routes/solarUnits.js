//routes/solarUnits.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');

// ADD new solar unit (officer & admin only)
router.post('/', authMiddleware, async (req, res) => {
  const { unitId, location, capacity, description } = req.body;

  if (!unitId?.trim() || !location?.trim()) {
    return res.status(400).json({ error: 'Unit ID and Location are required' });
  }

  if (!['admin', 'officer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You are not authorized to add solar units' });
  }

  try {
    const cleanUnitId = unitId.trim().toUpperCase();
    const unitRef = db.ref(`solarUnits/${cleanUnitId}`);

    const snapshot = await unitRef.once('value');
    if (snapshot.exists()) {
      return res.status(409).json({ error: 'Solar unit already exists' });
    }

    await unitRef.set({
      unitId: cleanUnitId,
      cebId: req.user.cebId, // owner = logged-in user
      location: location.trim(),
      capacity: capacity ? Number(capacity) : null,
      description: description?.trim() || null,
      voltage: 0,
      current: 0,
      power: 0,
      status: false,
      addedByUid: req.user.uid,
      addedByCebId: req.user.cebId,
      addedByRole: req.user.role,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    });

    res.status(201).json({ message: 'Solar unit added successfully', unitId: cleanUnitId });
  } catch (err) {
    console.error('Add solar unit error:', err);
    res.status(500).json({ error: 'Failed to add solar unit' });
  }
});

// GET all solar units (filtered by role on frontend)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.ref('solarUnits').once('value');
    const unitsObj = snapshot.val() || {};
    const units = Object.values(unitsObj);
    res.json(units);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch solar units' });
  }
});

// GET single solar unit (for edit page)
router.get('/:unitId', authMiddleware, async (req, res) => {
  const { unitId } = req.params;

  try {
    const snapshot = await db.ref(`solarUnits/${unitId}`).once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Solar unit not found' });
    }

    res.json(snapshot.val());
  } catch (err) {
    console.error('Fetch unit error:', err);
    res.status(500).json({ error: 'Failed to fetch solar unit' });
  }
});

// UPDATE / EDIT solar unit (officer & admin only)
router.patch('/:unitId', authMiddleware, async (req, res) => {
  const { unitId } = req.params;
  const { location, capacity, description } = req.body;

  if (!['admin', 'officer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You are not authorized to edit solar units' });
  }

  try {
    const unitRef = db.ref(`solarUnits/${unitId}`);
    const snapshot = await unitRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Solar unit not found' });
    }

    const updateData = {
      lastUpdated: Date.now(),
    };

    if (location !== undefined) updateData.location = location.trim();
    if (capacity !== undefined) updateData.capacity = capacity ? Number(capacity) : null;
    if (description !== undefined) updateData.description = description.trim() || null;

    await unitRef.update(updateData);

    res.json({ message: 'Solar unit updated successfully' });
  } catch (err) {
    console.error('Update solar unit error:', err);
    res.status(500).json({ error: 'Failed to update solar unit' });
  }
});

// DELETE solar unit (admin only)
router.delete('/:unitId', authMiddleware, async (req, res) => {
  const { unitId } = req.params;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete solar units' });
  }

  try {
    const unitRef = db.ref(`solarUnits/${unitId}`);
    const snapshot = await unitRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Solar unit not found' });
    }

    await unitRef.remove();
    res.json({ message: 'Solar unit deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete solar unit' });
  }
});




// GET stats (your existing route)--fix this 
router.patch('/:unitId/status', authMiddleware, async (req, res) => {
  const { unitId } = req.params;
  const { status } = req.body;

  try {
    const unitRef = db.ref(`solarUnits/${unitId}`);
    const snapshot = await unitRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Solar unit not found' });
    }

    await unitRef.update({ status, lastUpdated: Date.now() });

    const updatedUnit = (await unitRef.once('value')).val();
    res.json(updatedUnit);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
