require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  },

  slack: {
    userToken: process.env.SLACK_USER_TOKEN
  }
};

// Validate required config
function validateConfig() {
  const missing = [];

  if (!config.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.slack.userToken) missing.push('SLACK_USER_TOKEN');

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some features may not work. See .env.example for required variables.');
  }
}

validateConfig();

module.exports = config;
