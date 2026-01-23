const express = require('express');
const router = express.Router();
const googleService = require('../services/google');
const tokenStore = require('../services/tokens');

// Start Google OAuth flow
router.get('/start', (req, res) => {
  const authUrl = googleService.getAuthUrl();
  res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.send(`
      <html>
        <body>
          <h1>Authentication Failed</h1>
          <p>Error: ${error}</p>
          <a href="/">Go back</a>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    await googleService.exchangeCodeForTokens(code);
    res.redirect('/');
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).send(`
      <html>
        <body>
          <h1>Authentication Failed</h1>
          <p>Could not exchange authorization code for tokens.</p>
          <p>Error: ${err.message}</p>
          <a href="/">Go back</a>
        </body>
      </html>
    `);
  }
});

// Logout / disconnect Google
router.get('/logout', (req, res) => {
  tokenStore.clearGoogleTokens();
  res.redirect('/');
});

module.exports = router;
