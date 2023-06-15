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
    log('warn', `Invalid AUDIT_TTL_DAYS environment variable value: ${process.env.AUDIT_TTL_DAYS}. Using default value of ${AUDIT_TTL_DEFAULT_DAYS}.`);
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
 * Asynchronously fetches the Markdown content from a specified audit URL and
 * calculates the difference between this content and the Markdown content from
 * the latest audit, if any exists.
 *
 * @async
 * @function
 * @param {Object} site - The site that was audited.
 * @param {Object[]} site.audits - An array of previous audits. The last element, if present, contains the latest audit's Markdown content.
 * @param {Object} audit - The current audit object containing lighthouse result.
 * @param {Object} audit.lighthouseResult - The lighthouse result object.
 * @param {string} audit.lighthouseResult.finalUrl - The final URL where the Markdown content is located.
 * @returns {Promise<Object|null>} A promise that resolves to an object containing the Markdown content and its diff with the latest audit, or `null` if there was an error or the final URL was not found. The object has the following shape:
 *   {
 *     diff: string|null,      // The diff between the latest audit's Markdown content and the current Markdown content in patch format, or null if contents are identical or latest audit doesn't exist.
 *     content: string         // The Markdown content fetched from the final URL.
 *   }
 * @throws Will throw an error if there's a network issue or some other error while downloading the Markdown content.
 */

async function fetchMarkdownDiff(site, audit) {
  const url = audit.lighthouseResult?.finalUrl;

  if (!url) {
    log('error', 'Final URL not found in the audit object.');
    return null;
  }

  // Download the markdown content
  const markdownUrl = url.endsWith('/') ? `${url}index.md` : `${url}.md`;

  try {
    const response = await axios.get(markdownUrl);
    const markdownContent = response.data;

    log('info', `Downloaded Markdown content from ${markdownUrl}`);

    // Check if there is a latest audit with markdownContent
    const latestAudit = site.audits && site.audits[site.audits.length - 1];

    // Only calculate the diff if content has changed
    if (latestAudit && latestAudit.markdownContent !== markdownContent) {
      // Create a patch format diff
      const markdownDiff = jsdiff.createPatch(markdownUrl, latestAudit.markdownContent, markdownContent);
      return {
        diff: markdownDiff,
        content: markdownContent,
      };
    }

    return {
      diff: null,
      content: markdownContent,
    };
  } catch (err) {
    log('error', 'Error while downloading Markdown content:', err);
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
 * Fetches and compiles the diffs of all changes made in a GitHub repository between two date-times using the GitHub API.
 *
 * @async
 * @function
 * @param {Object} site - An object containing information about the site and GitHub repository.
 * @param {string} site.gitHubURL - The URL of the GitHub repository from which the diffs will be fetched (e.g. 'https://github.com/user/repo').
 * @param {string} [site.lastAudited] - The start date-time in ISO format (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ'). If not provided, it defaults to 24 hours before the end date-time.
 * @param {Object} audit - An object containing information about the audit.
 * @param {string} audit.lighthouseResult.fetchTime - The end date-time in ISO format at which the audit was fetched (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ').
 * @param {string} githubId - The GitHub client ID for authentication.
 * @param {string} githubSecret - The GitHub client secret for authentication.
 * @returns {Promise<string>} A promise that resolves to a string containing the compiled diffs in patch format between the given date-times. If there's an error fetching the data, the promise resolves to an empty string.
 * @throws {Error} Will throw an error if there's a network issue or some other error while fetching data from the GitHub API.
 * @example
 * fetchGithubDiff(
 *   { gitHubURL: 'https://github.com/myOrg/myRepo', lastAudited: '2023-06-15T00:00:00.000Z' },
 *   { lighthouseResult: { fetchTime: '2023-06-16T00:00:00.000Z' } },
 *   'yourGithubId',
 *   'yourGithubSecret'
 * ).then(diffs => console.log(diffs));
 */
async function fetchGithubDiff(site, audit, githubId, githubSecret) {
  try {
    const until = new Date(audit.lighthouseResult.fetchTime);
    const since = site.lastAudited ? new Date(site.lastAudited) : new Date(until - SECONDS_IN_A_DAY * 1000); // 24 hours before until
    const repoPath = new URL(site.gitHubURL).pathname.slice(1); // Removes leading '/'

    log('info', `Fetching diffs for ${repoPath} between ${since.toISOString()} and ${until.toISOString()}`);

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

    log('info', `Found ${commitSHAs.length} commits.`);

    for (const sha of commitSHAs) {
      log('info', `Fetching diff for commit ${sha}`);

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
        log('info', `Added commit ${sha} (${totalSize} of ${MAX_DIFF_SIZE}) to diff.`);
      } else {
        log('warn', `Skipping commit ${sha} because it is binary or too large (${totalSize} of ${MAX_DIFF_SIZE}).`);
        break;
      }
    }

    return diffs;
  } catch (error) {
    log('error', 'Error fetching data:', error.response ? error.response.data : error);
    return '';
  }
}

/**
 * A utility log method to streamline logging.
 *
 * @param {string} level - The log level ('info', 'error', 'warn').
 * @param {string} message - The message to log.
 * @param {...any} args - Additional arguments to log.
 */
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();

  switch (level) {
    case 'info':
      console.info(`[${timestamp}] INFO: ${message}`, ...args);
      break;
    case 'error':
      console.error(`[${timestamp}] ERROR: ${message}`, ...args);
      break;
    case 'warn':
      console.warn(`[${timestamp}] WARN: ${message}`, ...args);
      break;
    default:
      console.log(`[${timestamp}] ${message}`, ...args);
      break;
  }
};

module.exports = {
  fetchGithubDiff,
  fetchMarkdownDiff,
  getAuditTTL,
  performPSICheck,
  sleep,
  log,
};
