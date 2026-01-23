// Common words to ignore when extracting keywords
const STOP_WORDS = new Set([
  // Articles and pronouns
  'the', 'a', 'an', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  // Verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'want', 'get', 'got', 'getting', 'make', 'made', 'let', 'know', 'think', 'see',
  // Prepositions
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
  'before', 'between', 'under', 'during', 'without', 'through', 'against', 'above', 'below',
  // Conjunctions
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'while', 'although', 'because', 'so',
  // Adverbs
  'just', 'also', 'very', 'really', 'only', 'even', 'still', 'already', 'always', 'never', 'now',
  'here', 'there', 'today', 'tomorrow', 'yesterday',
  // Common chat words
  'hi', 'hello', 'hey', 'thanks', 'thank', 'please', 'yes', 'no', 'ok', 'okay', 'sure', 'yeah',
  'gonna', 'wanna', 'gotta', 'dont', 'doesnt', 'didnt', 'cant', 'wont', 'isnt', 'arent',
  // Question words
  'what', 'which', 'who', 'whom', 'whose', 'why', 'how',
  // Other common
  'not', 'all', 'some', 'any', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'such',
  'than', 'too', 'own', 'same', 'as', 'well', 'back', 'been', 'being'
]);

/**
 * Extract keywords from text using frequency analysis
 * @param {string} text - Input text
 * @param {number} maxKeywords - Maximum keywords to return
 * @returns {string[]} Array of keywords
 */
function extractKeywords(text, maxKeywords = 5) {
  if (!text || typeof text !== 'string') return [];

  // Normalize text and split into words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // Count frequency
  const frequency = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  // Sort by frequency and return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Detect project names/identifiers using common patterns
 * @param {string} text - Input text
 * @returns {string[]} Array of detected project identifiers
 */
function detectProjectNames(text) {
  if (!text || typeof text !== 'string') return [];

  const projects = new Set();

  // JIRA-style: PROJ-123, ABC-1234
  const jiraPattern = /\b[A-Z]{2,10}-\d+\b/g;
  const jiraMatches = text.match(jiraPattern) || [];
  jiraMatches.forEach(m => projects.add(m));

  // GitHub-style: #123, repo#123
  const issuePattern = /#\d+\b/g;
  const issueMatches = text.match(issuePattern) || [];
  issueMatches.forEach(m => projects.add(m));

  // Hashtags: #project-name, #feature
  const hashtagPattern = /#[a-zA-Z][\w-]*/g;
  const hashtagMatches = text.match(hashtagPattern) || [];
  hashtagMatches.forEach(m => projects.add(m));

  // Bracketed: [Project X], [Feature]
  const bracketPattern = /\[[\w\s-]+\]/g;
  const bracketMatches = text.match(bracketPattern) || [];
  bracketMatches.forEach(m => projects.add(m));

  return Array.from(projects);
}

/**
 * Combine keyword extraction and project detection
 * @param {string} text - Input text
 * @returns {{ keywords: string[], projects: string[] }}
 */
function analyzeText(text) {
  return {
    keywords: extractKeywords(text),
    projects: detectProjectNames(text)
  };
}

module.exports = {
  extractKeywords,
  detectProjectNames,
  analyzeText,
  STOP_WORDS
};
