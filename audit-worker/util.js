const axios = require('axios');

const SECONDS_IN_A_DAY = 86400; // 24 * 60 * 60
const MAX_DIFF_SIZE = 102400; // 100 * 1024

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const formatURL = (input) => {
  const urlPattern = /^https?:\/\//i;

  if (urlPattern.test(input)) {
    return input.replace(/^http:/i, 'https:');
  } else {
    return `https://${input}`;
  }
}

const getPSIApiUrl = (siteUrl) => {
  const urlParameters = new URLSearchParams({
    url: formatURL(siteUrl),
    key: process.env.PAGESPEED_API_KEY,
  });

  return `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${urlParameters.toString()}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile`;
}

const getAuditTTL = () => {
  let auditTtlDays = parseInt(process.env.AUDIT_TTL_DAYS) || 30;

  if (!Number.isInteger(auditTtlDays) || auditTtlDays <= 0) {
    console.warn(`Invalid AUDIT_TTL_DAYS environment variable value: ${process.env.AUDIT_TTL_DAYS}. Using default value of 30.`);
    auditTtlDays = 30;
  }

  return auditTtlDays * 24 * 60 * 60;
}

const processAuditData = (data) => {
  for (let key in data) {
    if (typeof data[key] === 'object' && data[key] !== null) {
      processAuditData(data[key]);
    }

    if (key.includes('.')) {
      const newKey = key.replace('.', '_');
      data[newKey] = data[key];
      delete data[key];
    }
  }
}

const performPSICheck = async (domain) => {
  const apiURL = getPSIApiUrl(domain);

  const { data: lhs } = await axios.get(apiURL);

  processAuditData(lhs);

  return lhs;
}

/**
 * Downloads the Markdown content from the specified URL.
 *
 * @param {object} audit - The audit object containing the lighthouse result.
 * @param {string} audit.lighthouseResult.finalUrl - The final URL to process.
 * @returns {Promise<string>} - The downloaded Markdown content.
 */
async function getMarkdownContent(audit) {
  const url = audit.lighthouseResult?.finalUrl;

  if (!url) {
    console.error('Final URL not found in the audit object.');
    return null;
  }

  // Add ".md" to the URL if it doesn't end with a slash, otherwise add "index.md"
  const markdownUrl = url.endsWith('/') ? `${url}index.md` : `${url}.md`;

  try {
    const response = await axios.get(markdownUrl);
    console.info(`Downloaded Markdown content from ${markdownUrl}`);
    return response.data;
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
  let baseUrl = `https://api.github.com/repos/${githubOrg}/${repoName}`;

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
async function fetchDiffs(site, audit, githubId, githubSecret) {
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
  performPSICheck,
  fetchDiffs,
  getAuditTTL,
  getMarkdownContent,
  sleep,
}
