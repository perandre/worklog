const { extractKeywords, detectProjectNames } = require('./keywords');

/**
 * Group activities into hourly buckets
 * @param {Array} activities - All activities from all sources
 * @param {number} startHour - Work day start hour (default 8)
 * @param {number} endHour - Work day end hour (default 16)
 * @returns {Object} Activities grouped by hour
 */
function bucketByHour(activities, startHour = 8, endHour = 16) {
  const buckets = {};

  // Initialize empty buckets for work hours
  for (let hour = startHour; hour < endHour; hour++) {
    buckets[hour] = [];
  }

  for (const activity of activities) {
    if (!activity.timestamp) continue;

    const timestamp = new Date(activity.timestamp);
    const hour = timestamp.getHours();

    // Skip if outside work hours
    if (hour < startHour || hour >= endHour) continue;

    // Handle spanning activities (like calendar events)
    if (activity.endTime) {
      const endTime = new Date(activity.endTime);
      const endHourCapped = Math.min(endTime.getHours(), endHour - 1);

      for (let h = hour; h <= endHourCapped; h++) {
        if (h >= startHour && h < endHour) {
          buckets[h].push({
            ...activity,
            isSpanning: h !== hour,
            spanStart: h === hour
          });
        }
      }
    } else {
      buckets[hour].push(activity);
    }
  }

  return buckets;
}

/**
 * Normalize email subject to identify conversation threads
 * Removes Re:, Sv:, Fwd:, etc. prefixes
 */
function normalizeSubject(subject) {
  if (!subject) return '';
  return subject
    .replace(/^(re|sv|fwd|fw|aw|antw):\s*/gi, '')
    .replace(/^(re|sv|fwd|fw|aw|antw):\s*/gi, '') // Run twice for nested prefixes
    .trim()
    .toLowerCase();
}

/**
 * Check if email is from Google Calendar
 */
function isCalendarEmail(email) {
  const from = (email.from || '').toLowerCase();
  return from.includes('calendar-notification@google.com') ||
         from.includes('google calendar') ||
         from.includes('calendar.google.com');
}

/**
 * Deduplicate emails by conversation thread
 * Keeps only the first email from each thread
 */
function dedupeEmailsByThread(emails) {
  const seen = new Set();
  return emails.filter(email => {
    const threadKey = normalizeSubject(email.subject);
    if (seen.has(threadKey)) {
      return false;
    }
    seen.add(threadKey);
    return true;
  });
}

/**
 * Merge and analyze activities within an hour bucket
 * @param {Array} hourActivities - Activities for a single hour
 * @returns {Object} Merged activity data with keywords
 */
function mergeHourActivities(hourActivities) {
  if (!hourActivities || hourActivities.length === 0) {
    return {
      primary: null,
      communications: [],
      keywords: [],
      projects: []
    };
  }

  // Separate by source
  const calendar = hourActivities.filter(a => a.source === 'calendar');
  const slack = hourActivities.filter(a => a.source === 'slack');
  const gmail = hourActivities.filter(a => a.source === 'gmail');
  const docs = hourActivities.filter(a => a.source === 'docs');

  // Calendar events are primary (meeting time)
  const primary = calendar.length > 0 ? calendar[0] : null;

  // Filter and dedupe emails
  const filteredEmails = dedupeEmailsByThread(
    gmail.filter(email => !isCalendarEmail(email))
  );

  // Combine communications (including doc edits)
  const communications = [...slack, ...filteredEmails, ...docs].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Extract keywords from all text content
  const allText = hourActivities
    .map(a => [
      a.title || '',
      a.subject || '',
      a.text || '',
      a.description || '',
      a.snippet || ''
    ].join(' '))
    .join(' ');

  const keywords = extractKeywords(allText, 5);
  const projects = detectProjectNames(allText);

  return {
    primary,
    communications,
    keywords,
    projects
  };
}

/**
 * Process all activities into hourly summaries
 * @param {Array} activities - All activities from all sources
 * @param {number} startHour - Work day start hour
 * @param {number} endHour - Work day end hour
 * @returns {Object} Processed hourly data
 */
function processActivities(activities, startHour = 8, endHour = 16) {
  const buckets = bucketByHour(activities, startHour, endHour);
  const processed = {};

  for (const [hour, hourActivities] of Object.entries(buckets)) {
    processed[hour] = mergeHourActivities(hourActivities);
  }

  return processed;
}

/**
 * Get summary statistics for a day
 * @param {Object} hourlyData - Processed hourly data
 * @returns {Object} Summary stats
 */
function getDaySummary(hourlyData) {
  let totalMeetings = 0;
  let totalSlackMessages = 0;
  let totalEmails = 0;
  let totalDocEdits = 0;
  const allKeywords = [];
  const allProjects = [];

  for (const hourData of Object.values(hourlyData)) {
    if (hourData.primary && !hourData.primary.isSpanning) {
      totalMeetings++;
    }
    totalSlackMessages += hourData.communications.filter(c => c.source === 'slack').length;
    totalEmails += hourData.communications.filter(c => c.source === 'gmail').length;
    totalDocEdits += hourData.communications.filter(c => c.source === 'docs').length;
    allKeywords.push(...hourData.keywords);
    allProjects.push(...hourData.projects);
  }

  // Get top keywords across the day
  const keywordFreq = {};
  for (const kw of allKeywords) {
    keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
  }
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);

  // Dedupe projects
  const uniqueProjects = [...new Set(allProjects)];

  return {
    totalMeetings,
    totalSlackMessages,
    totalEmails,
    totalDocEdits,
    topKeywords,
    projects: uniqueProjects
  };
}

module.exports = {
  bucketByHour,
  mergeHourActivities,
  processActivities,
  getDaySummary
};
