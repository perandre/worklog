const { google } = require('googleapis');
const config = require('../config');
const tokenStore = require('./tokens');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.activity.readonly'
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

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dateStr = startOfDay.toISOString().split('T')[0];

  try {
    const driveActivity = google.driveactivity({ version: 'v2', auth });

    // Fetch all activity pages for this date
    let allActivities = [];
    let pageToken = null;

    console.log(`[Drive Activity] Fetching activity for ${dateStr}`);
    console.log(`[Drive Activity] Filter: time >= "${startOfDay.toISOString()}" AND time <= "${endOfDay.toISOString()}"`);

    do {
      const response = await driveActivity.activity.query({
        requestBody: {
          filter: `time >= "${startOfDay.toISOString()}" AND time <= "${endOfDay.toISOString()}"`,
          consolidationStrategy: { none: {} },
          pageSize: 100,
          pageToken
        }
      });

      allActivities = allActivities.concat(response.data.activities || []);
      pageToken = response.data.nextPageToken;
      console.log(`[Drive Activity] Fetched page with ${response.data.activities?.length || 0} activities, hasMore: ${!!pageToken}`);
    } while (pageToken);

    console.log(`[Drive Activity] Total activities fetched: ${allActivities.length}`);

    // Log all action types we're seeing
    const actionTypeCounts = {};
    for (const activity of allActivities) {
      const action = activity.primaryActionDetail || {};
      const type = Object.keys(action)[0] || 'unknown';
      actionTypeCounts[type] = (actionTypeCounts[type] || 0) + 1;
    }
    console.log(`[Drive Activity] Action types found:`, actionTypeCounts);

    const docEdits = [];

    for (const activity of allActivities) {
      const action = activity.primaryActionDetail;
      if (!action) {
        console.log(`[Drive Activity] Skipping activity with no primaryActionDetail`);
        continue;
      }

      // Capture all meaningful action types
      const actionType = action.edit ? 'edit' :
                        action.comment ? 'comment' :
                        action.create ? 'create' :
                        action.delete ? 'delete' :
                        action.rename ? 'rename' :
                        action.move ? 'move' : null;

      if (!actionType) {
        console.log(`[Drive Activity] Skipping unhandled action type:`, Object.keys(action));
        continue;
      }

      // Get target info - check all targets, not just first
      for (const target of activity.targets || []) {
        if (!target?.driveItem) continue;

        const driveItem = target.driveItem;

        // Skip folders
        if (driveItem.mimeType?.includes('folder')) {
          console.log(`[Drive Activity] Skipping folder: ${driveItem.title}`);
          continue;
        }

        const timestamp = activity.timestamp;
        if (!timestamp) continue;

        const hour = new Date(timestamp).getHours();
        console.log(`[Drive Activity] Found: ${actionType} on "${driveItem.title}" at hour ${hour} (${driveItem.mimeType || 'unknown type'})`);

        docEdits.push({
          source: 'docs',
          type: actionType,
          title: driveItem.title || 'Untitled',
          docId: driveItem.name?.replace('items/', ''),
          timestamp: new Date(timestamp)
        });
      }
    }

    console.log(`[Drive Activity] Total doc edits before dedupe: ${docEdits.length}`);

    // Dedupe by doc title + hour (same doc can appear in multiple hours)
    const seen = new Set();
    const result = docEdits.filter(edit => {
      const hour = edit.timestamp.getHours();
      const key = `${edit.title}-${hour}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Drive Activity] Final result after dedupe: ${result.length} entries`);
    return result;
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
