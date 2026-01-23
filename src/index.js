require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Work Activity Tracker                           ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${config.port}                 ║
║                                                           ║
║  Status:                                                  ║
║    Google: ${config.google.clientId ? 'Configured ✓' : 'Not configured ✗'}                               ║
║    Slack:  ${config.slack.userToken ? 'Configured ✓' : 'Not configured ✗'}                               ║
║                                                           ║
║  If not configured, copy .env.example to .env and fill    ║
║  in your API credentials.                                 ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
