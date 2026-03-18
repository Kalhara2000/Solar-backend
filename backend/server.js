// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const solarUnitRoutes = require('./routes/solarUnits');
const userManagementRoutes = require('./routes/userManagement');

const app = express();

// Allow frontend (React) to communicate with backend
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// ------------------- Routes -------------------
app.use('/api/auth', authRoutes);           // Login / Register
app.use('/api/solar-units', solarUnitRoutes); // Solar Managemet
app.use('/api/users', userManagementRoutes);  // User Management

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});