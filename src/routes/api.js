const express = require('express');
const router = express.Router();
const googleService = require('../services/google');
const slackService = require('../services/slack');
const aggregator = require('../lib/aggregator');

// Get activities for a specific date
router.get('/activities', async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Check Google authentication
  if (!googleService.isAuthenticated()) {
    return res.status(401).json({
      error: 'Google authentication required',
      authUrl: '/auth/start'
    });
  }

  try {
    // Fetch from all sources in parallel
    const [calendarEvents, emails, slackMessages, docActivity] = await Promise.all([
      googleService.getCalendarEvents(date).catch(err => {
        console.error('Calendar fetch error:', err.message);
        return [];
      }),
      googleService.getEmails(date).catch(err => {
        console.error('Email fetch error:', err.message);
        return [];
      }),
      slackService.getMessages(date).catch(err => {
        console.error('Slack fetch error:', err.message);
        return [];
      }),
      googleService.getDocActivity(date).catch(err => {
        console.error('Docs fetch error:', err.message);
        return [];
      })
    ]);

    // Combine all activities
    const allActivities = [...calendarEvents, ...emails, ...slackMessages, ...docActivity];

    // Process into hourly buckets
    const hours = aggregator.processActivities(allActivities);
    const summary = aggregator.getDaySummary(hours);

    res.json({
      date,
      hours,
      summary,
      sources: {
        calendar: calendarEvents.length,
        gmail: emails.length,
        slack: slackMessages.length,
        docs: docActivity.length
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);

    // Check if it's an auth error
    if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
      return res.status(401).json({
        error: 'Google token expired. Please re-authenticate.',
        authUrl: '/auth/start'
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Get connection status for all services
router.get('/status', (req, res) => {
  res.json({
    google: googleService.isAuthenticated(),
    slack: slackService.isConfigured()
  });
});

module.exports = router;
