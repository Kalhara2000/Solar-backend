// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const solarUnitRoutes = require('./routes/solarUnits');
const userManagementRoutes = require('./routes/userManagement'); // ← add this

const app = express();

app.use(cors({ origin: 'http://localhost:3000' })); // frontend URL
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/solar-units', solarUnitRoutes);
app.use('/api/users', userManagementRoutes); // ← mount UserManagement route

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CEB Solar Backend running on http://localhost:${PORT}`);
});