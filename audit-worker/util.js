const axios = require('axios');
const jsdiff = require('diff');

const SECONDS_IN_A_DAY = 86400;
const MAX_DIFF_SIZE = 102400;
const GITHUB_API_BASE_URL = 'https://api.github.com';
const PAGESPEED_API_BASE_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const AUDIT_TTL_DEFAULT_DAYS = 30;

/**
 * Sleeps for the specified amount of milliseconds.
 *
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise} A promise that resolves after the specified number of milliseconds.
 */
const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats an input URL to be HTTPS.
 *
 * @param {string} input - The input URL.
 * @returns {string} The formatted URL with HTTPS.
 */
const formatURL = (input) => {
  const urlPattern = /^https?:\/\//i;

  if (urlPattern.test(input)) {
    return input.replace(/^http:/i, 'https:');
  } else {
    return `https://${input}`;
  }
}

/**
 * Builds a PageSpeed Insights API URL with the necessary parameters.
 *
 * @param {string} siteUrl - The URL of the site to analyze.
 * @returns {string} The full API URL with parameters.
 */
const getPSIApiUrl = (siteUrl) => {
  const params = new URLSearchParams({
    url: formatURL(siteUrl),
    key: process.env.PAGESPEED_API_KEY,
    strategy: 'mobile'
  });

  ['performance', 'accessibility', 'best-practices', 'seo'].forEach(category => {
    params.append('category', category);
  });

  return `${PAGESPEED_API_BASE_URL}?${params.toString()}`;
};

/**
 * Retrieves the audit time-to-live (TTL) in seconds.
 *
 * @returns {number} The audit TTL in seconds.
 */
const getAuditTTL = () => {
  let auditTtlDays = parseInt(process.env.AUDIT_TTL_DAYS) || AUDIT_TTL_DEFAULT_DAYS;

  if (!Number.isInteger(auditTtlDays) || auditTtlDays <= 0) {
    console.warn(`Invalid AUDIT_TTL_DAYS environment variable value: ${process.env.AUDIT_TTL_DAYS}. Using default value of ${AUDIT_TTL_DEFAULT_DAYS}.`);
    auditTtlDays = AUDIT_TTL_DEFAULT_DAYS;
  }

  return auditTtlDays * SECONDS_IN_A_DAY;
};

/**
 * Processes audit data by replacing keys with dots with underscore.
 *
 * @param {object} data - The audit data object.
 * @returns {object} The processed audit data.
 */
const processAuditData = (data) => {
  const newData = { ...data };

  for (let key in newData) {
    if (typeof newData[key] === 'object' && newData[key] !== null) {
      newData[key] = processAuditData(newData[key]);
    }

    if (key.includes('.')) {
      const newKey = key.replace('.', '_');
      newData[newKey] = newData[key];
      delete newData[key];
    }
  }

  return newData;
};

/**
 * Performs a PageSpeed Insights check on the specified domain.
 *
 * @param {string} domain - The domain to perform the PSI check on.
 * @returns {Promise<object>} The processed PageSpeed Insights audit data.
 */
const performPSICheck = async (domain) => {
  const apiURL = getPSIApiUrl(domain);

  const { data: lhs } = await axios.get(apiURL);

  return processAuditData(lhs);
};

/**
 * Fetches the Markdown content from the specified URL and creates a diff with the Markdown content from the latest audit.
 *
 * @param {object} site - The site that was audited.
 * @param {Array} site.audits - Array of audits.
 * @param {object} audit - The audit object containing the lighthouse result.
 * @param {string} audit.lighthouseResult.finalUrl - The final URL to process.
 * @returns {Promise<Object>} - The current markdown content and the diff.
 */
async function fetchMarkdownDiff(site, audit) {
  const url = audit.lighthouseResult?.finalUrl;

  if (!url) {
    console.error('Final URL not found in the audit object.');
    return null;
  }

  // Download the markdown content
  const markdownUrl = url.endsWith('/') ? `${url}index.md` : `${url}.md`;

  try {
    const response = await axios.get(markdownUrl);
    const markdownContent = response.data;
    let markdownDiff = null;

    console.info(`Downloaded Markdown content from ${markdownUrl}`);

    // Check if there is a latest audit with markdownContent
    const latestAudit = site.audits?.slice(-1)[0];

    if (latestAudit && latestAudit.markdownContent) {
      // Create a patch format diff
      markdownDiff = jsdiff.createPatch(markdownUrl, latestAudit.markdownContent, markdownContent)
    }

    return {
      diff: markdownDiff,
      content: markdownContent,
    };
  } catch (err) {
    console.error('Error while downloading Markdown content:', err);
    return null;
  }
}

/**
 * Creates a URL for the GitHub API.
 *
 * @param {string} githubOrg - The name of the GitHub organization.
 * @param {string} repoName - The name of the repository (optional).
 * @param {string} path - Additional path (optional).
 * @param {number} page - The page number for pagination (optional).
 * @returns {string} The created GitHub API URL.
 */
function createGithubApiUrl(githubOrg, repoName = '', path = '', page = 1) {
  let baseUrl = `${GITHUB_API_BASE_URL}/repos/${githubOrg}/${repoName}`;

  if (path) {
    baseUrl += `/${path}`;
  }

  baseUrl += `?page=${page}&per_page=100`;

  return baseUrl;
}

/**
 * Creates a Basic Authentication header value from a given GitHub ID and secret.
 *
 * @param {string} githubId - The GitHub client ID.
 * @param {string} githubSecret - The GitHub client secret.
 * @returns {string} - The Basic Authentication header value.
 * @throws {Error} - Throws an error if GitHub credentials are not provided.
 */
function createGithubAuthHeaderValue(githubId, githubSecret) {
  if (!githubId || !githubSecret) {
    throw new Error('GitHub credentials not provided');
  }
  return `Basic ${Buffer.from(`${githubId}:${githubSecret}`).toString('base64')}`;
}

/**
 * Fetch diffs of all changes between two date-times for a particular repository via the GitHub API.
 *
 * @param {Object} site - The site object containing the GitHub URL and last audited time.
 * @param {string} site.gitHubURL - The GitHub repository URL (e.g. https://github.com/myOrg/myRepo).
 * @param {string} [site.lastAudited] - The last audited date-time in ISO format.
 * @param {Object} audit - The audit object containing the lighthouse results.
 * @param {string} audit.lighthouseResult.fetchTime - The time the audit was fetched in ISO format.
 * @param {string} githubId - The GitHub client ID.
 * @param {string} githubSecret - The GitHub client secret.
 * @returns {Promise<string>} - The diffs between the given date-times in patch format.
 */
async function fetchGithubDiff(site, audit, githubId, githubSecret) {
  try {
    const until = new Date(audit.lighthouseResult.fetchTime);
    const since = site.lastAudited ? new Date(site.lastAudited) : new Date(until - SECONDS_IN_A_DAY * 1000); // 24 hours before until
    const repoPath = new URL(site.gitHubURL).pathname.slice(1); // Removes leading '/'

    console.info(`Fetching diffs for ${repoPath} between ${since.toISOString()} and ${until.toISOString()}`);

    const [githubOrg, repoName] = repoPath.split('/');

    const authHeader = createGithubAuthHeaderValue(githubId, githubSecret);
    const commitsUrl = createGithubApiUrl(githubOrg, repoName, 'commits');

    const response = await axios.get(commitsUrl, {
      params: {
        since: since.toISOString(),
        until: until.toISOString()
      },
      headers: {
        Authorization: authHeader
      }
    });

    const commitSHAs = response.data.map(commit => commit.sha);
    let diffs = '';
    let totalSize = 0;

    console.log(`Found ${commitSHAs.length} commits.`);

    for (const sha of commitSHAs) {
      console.info(`Fetching diff for commit ${sha}`);

      const diffUrl = createGithubApiUrl(githubOrg, repoName, `commits/${sha}`);

      const diffResponse = await axios.get(diffUrl, {
        headers: {
          Accept: 'application/vnd.github.v3.diff',
          Authorization: authHeader
        }
      });

      // Skip binary files and check the size of the diff
      if (!diffResponse.data.includes("Binary files differ") && (totalSize + diffResponse.data.length) < MAX_DIFF_SIZE) {
        diffs += diffResponse.data + '\n';
        totalSize += diffResponse.data.length;
        console.info(`Added commit ${sha} (${totalSize} of ${MAX_DIFF_SIZE}) to diff.`);
      } else {
        console.warn(`Skipping commit ${sha} because it is binary or too large (${totalSize} of ${MAX_DIFF_SIZE}).`);
        break;
      }
    }

    return diffs;
  } catch (error) {
    console.error('Error fetching data:', error.response ? error.response.data : error);
    return '';
  }
}

module.exports = {
  fetchGithubDiff,
  fetchMarkdownDiff,
  getAuditTTL,
  performPSICheck,
  sleep,
};
