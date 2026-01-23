const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

function readTokensFile() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = fs.readFileSync(TOKENS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading tokens file:', error.message);
  }
  return {};
}

function writeTokensFile(tokens) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing tokens file:', error.message);
    throw error;
  }
}

function getGoogleTokens() {
  const tokens = readTokensFile();
  return tokens.google || null;
}

function saveGoogleTokens(googleTokens) {
  const tokens = readTokensFile();
  tokens.google = googleTokens;
  writeTokensFile(tokens);
}

function clearGoogleTokens() {
  const tokens = readTokensFile();
  delete tokens.google;
  writeTokensFile(tokens);
}

module.exports = {
  getGoogleTokens,
  saveGoogleTokens,
  clearGoogleTokens
};
