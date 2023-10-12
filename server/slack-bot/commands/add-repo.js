const BaseCommand = require('./base-command.js');
const { getSiteByDomain, getSiteIdByDomain, updateSiteByDomain } = require('../../db.js');
const { invalidateCache } = require('../../cache.js');
const { queueSiteToAudit } = require('../../queue.js');
const { postErrorMessage, sendTextMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');
const { printSiteDetails } = require('../../utils/formatUtils.js');

const PHRASES = ['add repo', 'save repo', 'add repo by site'];

function AddRepoCommand(bot, axios) {
  const baseCommand = BaseCommand({
    id: 'add-github-repo',
    name: "Add GitHub Repo",
    description: 'Adds a Github repository to previously added site.',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {site} {githubRepoURL}`,
  });

  /**
   * Validates if the URL is a valid GitHub repository URL.
   *
   * @param {string} repoUrl - The GitHub repository URL.
   * @returns {boolean} true if the URL is valid, false otherwise.
   */
  function validateRepoUrl(repoUrl) {
    return /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/.test(repoUrl);
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
        if (error.response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch GitHub repository at '${repoUrl}', status: ${error.response.status}, ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error(`No response received from GitHub when fetching repository at '${repoUrl}'.`);
      } else {
        throw new Error(`Failed to set up request to fetch GitHub repository at '${repoUrl}': ${error.message}`);
      }
    }
  }

  /**
   * Execute function for AddRepoCommand. This function validates the input, fetches the repository
   * information from the GitHub API, and saves it as a site in the database.
   *
   * @param {Array} args - The arguments provided to the command.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, thread_ts, say) => {
    try {
      const [siteDomainInput, repoUrlInput] = args;
      const siteURL = extractDomainFromInput(siteDomainInput, false);
      let repoUrl = extractDomainFromInput(repoUrlInput, false);
      repoUrl = repoUrl.startsWith('https') ? '' : `https://${repoUrl}`;

      if (!siteURL || !repoUrl) {
        sendTextMessage(say, thread_ts, baseCommand.usage());
        return;
      }

      if (!validateRepoUrl(repoUrl)) {
        sendTextMessage(say, thread_ts, `:warning: '${repoUrl}' is not a valid GitHub repository URL.`);
        return;
      }

      const site = await getSiteByDomain(siteURL);
      if (!site) {
        sendTextMessage(say, thread_ts, `:warning: No site found with domain: ${siteURL}`);
        return;
      }

      const repoInfo = await fetchRepoInfo(repoUrl);

      if (repoInfo === null) {
        sendTextMessage(say, thread_ts, `:warning: The GitHub repository '${repoUrl}' could not be found (private repo?).`);
        return;
      }

      if (repoInfo.archived) {
        sendTextMessage(say, thread_ts, `:warning: The GitHub repository '${repoUrl}' is archived. Please unarchive it before adding it to a site.`);
        return;
      }

      const updatedSite = {
        gitHubURL: repoUrl,
      };

      await updateSiteByDomain(site.domain, updatedSite);
      site.gitHubURL = repoUrl;
      invalidateCache();

      const siteId = await getSiteIdByDomain(site.domain);

      await queueSiteToAudit({
        _id: siteId,
      })

      sendTextMessage(say, thread_ts, `
      :white_check_mark: Github repo is successfully added to the site!
      
${printSiteDetails(site)}
      
      First PSI check with new repo is triggered! :adobe-run:
      `);

    } catch (error) {
      await postErrorMessage(say, error);
    }
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    handleExecution,
  };
}

module.exports = AddRepoCommand;
