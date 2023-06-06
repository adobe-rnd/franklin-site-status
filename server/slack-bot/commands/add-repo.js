const BaseCommand = require('./base-command.js');

const { getSiteByGitHubRepoId, saveSite } = require('../../db.js');
const { postErrorMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');

const PHRASES = ['add repo', 'save repo', 'add domain by repo'];

function AddRepoCommand(bot, axios) {
  const baseCommand = BaseCommand({
    id: 'add-github-repo',
    name: "Add GitHub Repo",
    description: 'Adds a new site from a GitHub repository. Do not add repos from the _hlxsites_ Org, as those are automatically imported.',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {githubRepoURL};`,
  });

  /**
   * Extracts the last part of the incoming message.
   *
   * @param {string} message - The incoming message.
   * @returns {string} The GitHub repository URL.
   */
  function extractRepoUrlFromMessage(message) {
    const url = extractDomainFromInput(message, false);
    console.info(`Extracted repo URL from message: ${url}`);
    return url;
  }

  /**
   * Validates if the URL is a valid GitHub repository URL.
   *
   * @param {string} repoUrl - The GitHub repository URL.
   * @returns {boolean} true if the URL is valid, false otherwise.
   */
  function validateRepoUrl(repoUrl) {
    const repoUrlParts = repoUrl.split('github.com/');
    return repoUrlParts.length === 2 && /^[\w-]+\/[\w-]+(\.git)?$/.test(repoUrlParts[1]);
  }

  /**
   * Fetches repository information from the GitHub API.
   *
   * @param {string} repoUrl - The GitHub repository URL.
   * @returns {Object} The repository information.
   */
  async function fetchRepoInfo(repoUrl) {
    const repoApiUrl = `https://api.github.com/repos/${repoUrl.split('github.com/')[1]}`;
    try {
      const response = await axios.get(repoApiUrl);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Failed to fetch GitHub repository at '${repoUrl}', status: ${error.response.status}, ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error(`No response received from GitHub when fetching repository at '${repoUrl}'.`);
      } else {
        throw new Error(`Failed to set up request to fetch GitHub repository at '${repoUrl}': ${error.message}`);
      }
    }
  }

  /**
   * Saves the repository information as a site in the database.
   *
   * @param {Object} repoInfo - The repository information.
   * @returns {Object} The site information.
   */
  async function saveRepoAsSite(repoInfo) {
    const { owner, name, id, html_url } = repoInfo;
    const domain = `main--${name}--${owner.login}.hlx.live`;

    const site = {
      domain,
      name,
      githubId: id,
      gitHubURL: html_url,
      gitHubOrg: owner.login,
      createdAt: Date.now(),
      lastAudited: null,
      audits: [],
    };

    await saveSite(site);

    return site;
  }

  /**
   * Execute function for AddRepoCommand. This function validates the input, fetches the repository
   * information from the GitHub API, and saves it as a site in the database.
   *
   * @param {string} message - The incoming message.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const execute = async (message, say) => {
    try {
      const repoUrl = extractRepoUrlFromMessage(message);

      if (!repoUrl) {
        await say(baseCommand.usage());
        return;
      }

      if (!validateRepoUrl(repoUrl)) {
        await say(`:warning: '${repoUrl}' is not a valid GitHub repository URL.`);
        return;
      }

      const repoInfo = await fetchRepoInfo(repoUrl);
      const existingSite = await getSiteByGitHubRepoId(repoInfo.id);

      if (existingSite) {
        await say(`:notification_bell: A site with the GitHub repository '${repoUrl}' already exists.`);
        return;
      }

      const site = await saveRepoAsSite(repoInfo);

      await say(`
      :white_check_mark: Successfully added the site '${site.domain}' from the repository '${repoUrl}'.
      
      _Note: It may take up to 24 hours for the site to be audited the first time._
      `);

    } catch (error) {
      await postErrorMessage(say, error);
    }
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    execute,
  };
}

module.exports = AddRepoCommand;
