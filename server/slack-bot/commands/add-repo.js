const BaseCommand = require('./base-command.js');
const { getSiteByGitHubRepoId, createSite } = require('../../db.js');
const { postErrorMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');
const { printSiteDetails } = require('../../utils/formatUtils.js');

const PHRASES = ['add repo', 'save repo', 'add domain by repo'];

function AddRepoCommand(bot, axios) {
  const baseCommand = BaseCommand({
    id: 'add-github-repo',
    name: "Add GitHub Repo",
    description: 'Adds a new site from a GitHub repository. Do not add repos from the _hlxsites_ Org, as those are automatically imported. You can optionally provide a production URL in which case the site will be set to live and audits be run on the production URL.',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {githubRepoURL} [prodURL]`,
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
   * @param prodURL - The production URL, if provided.
   * @returns {Object} The site information.
   */
  async function saveRepoAsSite(repoInfo, prodURL) {
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

    if (prodURL) {
      console.debug(`Setting site ${domain} to live with prodURL ${prodURL}.`);
      site.isLive = true;
      site.prodURL = prodURL;
    }

    await createSite(site);

    return site;
  }

  /**
   * Execute function for AddRepoCommand. This function validates the input, fetches the repository
   * information from the GitHub API, and saves it as a site in the database.
   *
   * @param {Array} args - The arguments provided to the command.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, say) => {
    try {
      const [repoUrlInput, prodURLInput] = args;
      const repoUrl = extractDomainFromInput(repoUrlInput, false);
      const prodURL = extractDomainFromInput(prodURLInput, false);

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

      const site = await saveRepoAsSite(repoInfo, prodURL);

      await say(`
      :white_check_mark: Successfully added the site!
      
${printSiteDetails(site)}
      
      _Note: It may take a few hours for the site to be audited the first time._
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
