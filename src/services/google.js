const { google } = require('googleapis');
const config = require('../config');
const tokenStore = require('./tokens');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

function getAuthenticatedClient() {
  const tokens = tokenStore.getGoogleTokens();
  if (!tokens) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Auto-refresh handler
  oauth2Client.on('tokens', (newTokens) => {
    tokenStore.saveGoogleTokens({
      ...tokens,
      ...newTokens
    });
  });

  return oauth2Client;
}

async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  tokenStore.saveGoogleTokens(tokens);
  return tokens;
}

async function getCalendarEvents(date) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Google not authenticated');

  const calendar = google.calendar({ version: 'v3', auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  return (response.data.items || []).map(event => ({
    source: 'calendar',
    type: 'meeting',
    title: event.summary || '(No title)',
    description: event.description || '',
    timestamp: new Date(event.start.dateTime || event.start.date),
    endTime: new Date(event.end.dateTime || event.end.date),
    attendees: (event.attendees || []).map(a => a.email)
  }));
}

async function getEmails(date) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Google not authenticated');

  const gmail = google.gmail({ version: 'v1', auth });

  // Format date for Gmail query (YYYY/MM/DD)
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  const afterDate = `${year}/${month}/${day}`;
  const nextDay = new Date(dateObj);
  nextDay.setDate(nextDay.getDate() + 1);
  const beforeDate = `${nextDay.getFullYear()}/${String(nextDay.getMonth() + 1).padStart(2, '0')}/${String(nextDay.getDate()).padStart(2, '0')}`;

  const query = `after:${afterDate} before:${beforeDate}`;

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50
  });

  if (!response.data.messages) return [];

  const emails = await Promise.all(
    response.data.messages.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date']
        });

        const headers = detail.data.payload.headers || [];
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          source: 'gmail',
          type: 'email',
          subject: getHeader('Subject') || '(No subject)',
          from: getHeader('From'),
          to: getHeader('To'),
          timestamp: new Date(getHeader('Date')),
          snippet: detail.data.snippet || ''
        };
      } catch (error) {
        console.error(`Error fetching email ${msg.id}:`, error.message);
        return null;
      }
    })
  );

  return emails.filter(e => e !== null);
}

async function getDocActivity(date) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Google not authenticated');

  const drive = google.drive({ version: 'v3', auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Query for files modified by me on this date
    const response = await drive.files.list({
      q: `modifiedByMeTime >= "${startOfDay.toISOString()}" and modifiedByMeTime <= "${endOfDay.toISOString()}" and mimeType != "application/vnd.google-apps.folder"`,
      fields: 'files(id, name, mimeType, modifiedByMeTime, viewedByMeTime, createdTime)',
      orderBy: 'modifiedByMeTime desc',
      pageSize: 100
    });

    const files = response.data.files || [];

    return files.map(file => {
      // Determine if this was likely a create or edit
      const modifiedTime = new Date(file.modifiedByMeTime);
      const createdTime = new Date(file.createdTime);
      const isCreate = Math.abs(modifiedTime - createdTime) < 60000; // Within 1 minute

      return {
        source: 'docs',
        type: isCreate ? 'create' : 'edit',
        title: file.name || 'Untitled',
        docId: file.id,
        mimeType: file.mimeType,
        timestamp: modifiedTime
      };
    });
  } catch (error) {
    console.error('Error fetching doc activity:', error.message);
    return [];
  }
}

function isAuthenticated() {
  return tokenStore.getGoogleTokens() !== null;
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  getAuthenticatedClient,
  exchangeCodeForTokens,
  getCalendarEvents,
  getEmails,
  getDocActivity,
  isAuthenticated,
  SCOPES
};
