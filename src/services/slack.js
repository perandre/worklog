const { WebClient } = require('@slack/web-api');
const config = require('../config');

let slackClient = null;
const userCache = new Map();

function getClient() {
  if (!config.slack.userToken) {
    return null;
  }
  if (!slackClient) {
    slackClient = new WebClient(config.slack.userToken);
  }
  return slackClient;
}

// Check if a string looks like a Slack user ID (e.g., U04HHHCAD2N)
function isUserId(str) {
  return /^U[A-Z0-9]+$/i.test(str);
}

// Check if a string looks like a DM channel ID (e.g., D04HHHCAD2N)
function isDmChannelId(str) {
  return /^D[A-Z0-9]+$/i.test(str);
}

// Look up a user's display name, with caching
async function getUserName(client, userId) {
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }

  try {
    const response = await client.users.info({ user: userId });
    const name = response.user?.real_name || response.user?.name || userId;
    userCache.set(userId, name);
    return name;
  } catch (error) {
    userCache.set(userId, userId); // Cache the ID to avoid repeated failed lookups
    return userId;
  }
}

// Look up DM channel to find the other user
async function getDmUserName(client, channelId) {
  const cacheKey = `dm:${channelId}`;
  if (userCache.has(cacheKey)) {
    return userCache.get(cacheKey);
  }

  try {
    const response = await client.conversations.info({ channel: channelId });
    const userId = response.channel?.user;
    if (userId) {
      const name = await getUserName(client, userId);
      userCache.set(cacheKey, name);
      return name;
    }
  } catch (error) {
    // Ignore errors
  }

  userCache.set(cacheKey, 'DM');
  return 'DM';
}

async function getMessages(date) {
  const client = getClient();
  if (!client) {
    console.warn('Slack not configured, skipping');
    return [];
  }

  // Format date for Slack search (YYYY-MM-DD)
  const dateObj = new Date(date);
  const dateStr = dateObj.toISOString().split('T')[0];

  try {
    // Use search API to find all messages from the current user on this date
    // This is a single API call instead of fetching history from every channel
    const searchResponse = await client.search.messages({
      query: `from:me on:${dateStr}`,
      sort: 'timestamp',
      sort_dir: 'asc',
      count: 100
    });

    const matches = searchResponse.messages?.matches || [];

    // Collect IDs that need resolution
    const userIdsToResolve = new Set();
    const dmChannelsToResolve = new Set();

    for (const match of matches) {
      const channelName = match.channel?.name;
      const channelId = match.channel?.id;

      if (channelName && isUserId(channelName)) {
        userIdsToResolve.add(channelName);
      } else if (channelId && isDmChannelId(channelId)) {
        dmChannelsToResolve.add(channelId);
      }
    }

    // Resolve all user IDs and DM channels in parallel
    await Promise.all([
      ...Array.from(userIdsToResolve).map(id => getUserName(client, id)),
      ...Array.from(dmChannelsToResolve).map(id => getDmUserName(client, id))
    ]);

    // Build results with resolved names, grouped by channel+hour
    const groupedByChannelHour = new Map();

    for (const match of matches) {
      let channel = match.channel?.name || 'DM';
      const channelId = match.channel?.id;

      // Resolve channel name
      if (isUserId(channel)) {
        channel = userCache.get(channel) || channel;
      } else if (isDmChannelId(channelId)) {
        channel = userCache.get(`dm:${channelId}`) || 'DM';
      }

      const timestamp = new Date(parseFloat(match.ts) * 1000);
      const hour = timestamp.getHours();
      const key = `${channel}-${hour}`;

      // Keep only first message per channel per hour
      if (!groupedByChannelHour.has(key)) {
        groupedByChannelHour.set(key, {
          source: 'slack',
          type: 'message',
          channel,
          channelId,
          text: match.text || '',
          timestamp
        });
      }
    }

    return Array.from(groupedByChannelHour.values());
  } catch (error) {
    console.error('Error fetching Slack messages:', error.message);
    return [];
  }
}

function isConfigured() {
  return !!config.slack.userToken;
}

module.exports = {
  getMessages,
  isConfigured
};
