const BaseCommand = require('./base-command.js');
const { getSiteByDomain, updateSite } = require('../../db.js');
const { postErrorMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');

const PHRASES = ['set live status'];

/**
 * Factory function to create the SetLiveStatusCommand object.
 * @param {Object} bot - The bot instance.
 * @returns {Object} The SetLiveStatusCommand object.
 */
function SetLiveStatusCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'set-live-status',
    name: 'Set Live Status',
    description: 'Sets or unsets a site\'s "isLive" flag. If setting to isLive = true, a value for the site\'s production domain must be provided. If a site is set to live, the performance audit will use the specified production domain instead of the Franklin .live domain',
    phrases: PHRASES,
    usageText: `${PHRASES[0]} {siteDomain} {isLive} [prodDomain]`,
  });

  /**
   * Validates input, fetches the site by domain,
   * and updates the "isLive" status and "prodDomain" of the site.
   *
   * @param {string[]} args - The arguments provided to the command ([siteDomain, isLive, prodDomain]).
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, say) => {
    try {
      const [siteDomainInput, isLiveInput, prodDomainInput] = args;

      const siteDomain = extractDomainFromInput(siteDomainInput);
      const isLive = isLiveInput === 'true';
      const prodDomain = extractDomainFromInput(prodDomainInput);

      if (!siteDomain) {
        await say(':warning: Please provide a valid site domain.');
        return;
      }

      if (isLiveInput !== 'true' && isLiveInput !== 'false') {
        await say(':warning: Please specify the live status as either "true" or "false".');
        return;
      }

      if (isLive && !prodDomain) {
        await say(':warning: If setting isLive to true, a value for prodDomain must be provided.');
        return;
      }

      const site = await getSiteByDomain(siteDomain);

      if (!site) {
        await say(`:x: No site found with the domain '${siteDomain}'.`);
        return;
      }

      const updatedSite = {
        isLive: isLive,
      };

      if (isLive) {
        updatedSite.prodDomain = prodDomain;
      }

      await updateSite(site._id, updatedSite);

      let message = `:white_check_mark: Successfully updated the live status of the site '${siteDomain}'.\n\n`;
      message += isLive
        ? `:rocket: _Site was set live and audits will now be run against the production domain '${prodDomain}'._\n\n`
        : ':submarine: _Site was set to not live and audits will now be run against the .live domain._\n\n';

      await say(message);

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

module.exports = SetLiveStatusCommand;
