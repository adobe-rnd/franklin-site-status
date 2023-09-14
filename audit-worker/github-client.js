const axios = require('axios');
const { log } = require('./util.js');

const MAX_DIFF_SIZE = 102400; // Maximum size of diff in bytes
const SECONDS_IN_A_DAY = 86400; // Number of seconds in a day

function GithubClient(config) {
  const { baseUrl, githubId, githubSecret } = config;

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
    const repoPart = repoName ? `/${repoName}` : '';
    const pathPart = path ? `/${path}` : '';

    return `${baseUrl}/repos/${githubOrg}${repoPart}${pathPart}?page=${page}&per_page=100`;
  }

  /**
   * Creates a Basic Authentication header value from a given GitHub ID and secret.
   *
   * @returns {string} - The Basic Authentication header value.
   * @throws {Error} - Throws an error if GitHub credentials are not provided.
   */
  function createGithubAuthHeaderValue() {
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
   * @param {Object} audit - An object containing information about the audit.
   * @param {string} audit.result.fetchTime - The end date-time in ISO format at which the audit was fetched (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ').
   * @param {string} lastAuditedAt - The start date-time in ISO format (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ'). If not provided, it defaults to 24 hours before the end date-time.
   * @param {string} gitHubURL - The URL of the GitHub repository from which the diffs will be fetched (e.g. 'https://github.com/user/repo').
   * @returns {Promise<string>} A promise that resolves to a string containing the compiled diffs in patch format between the given date-times. If there's an error fetching the data, the promise resolves to an empty string.
   * @throws {Error} Will throw an error if there's a network issue or some other error while fetching data from the GitHub API.
   * @example
   * fetchGithubDiff(
   *   { gitHubURL: 'https://github.com/myOrg/myRepo', lastAudited: '2023-06-15T00:00:00.000Z' },
   *   { result: { fetchTime: '2023-06-16T00:00:00.000Z' } },
   *   'yourGithubId',
   *   'yourGithubSecret'
   * ).then(diffs => console.log(diffs));
   */

  async function fetchGithubDiff(audit, lastAuditedAt, gitHubURL) {
    const auditResult = audit.result;
    if (!gitHubURL) {
      log('info', `No github repo defined for ${auditResult.requestedUrl}. Skipping github diff calculation`);
      return '';
    }

    try {
      const until = new Date(auditResult.fetchTime);
      const since = lastAuditedAt ? new Date(lastAuditedAt) : new Date(until - SECONDS_IN_A_DAY * 1000); // 24 hours before until
      const repoPath = new URL(gitHubURL).pathname.slice(1); // Removes leading '/'

      log('info', `Fetching diffs for ${repoPath} between ${since.toISOString()} and ${until.toISOString()}`);

      const [githubOrg, repoName] = repoPath.split('/');

      const authHeader = createGithubAuthHeaderValue();
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

  return {
    createGithubApiUrl,
    createGithubAuthHeaderValue,
    fetchGithubDiff,
  }
}

module.exports = GithubClient;
