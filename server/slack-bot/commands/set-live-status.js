const BaseCommand = require('./base-command.js');
const { getSiteMetadataByDomain, updateSite } = require('../../db.js');
const { invalidateCache } = require('../../cache.js');
const { postErrorMessage, sendTextMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');

const PHRASES = ['toggle live status'];

/**
 * Factory function to create the SetLiveStatusCommand object.
 * @param {Object} bot - The bot instance.
 * @returns {Object} The SetLiveStatusCommand object.
 */
function SetLiveStatusCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'set-live-status',
    name: 'Toggle Live Status',
    description: 'Toggles a site\'s "isLive" flag.',
    phrases: PHRASES,
    usageText: `${PHRASES[0]} {site}`,
  });

  /**
   * Validates input, fetches the site by domain,
   * and updates the "isLive" status.
   *
   * @param {string[]} args - The arguments provided to the command ([siteDomain, isLive]).
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, thread_ts, say) => {
    try {
      const [siteDomainInput] = args;

      const siteDomain = extractDomainFromInput(siteDomainInput, false);

      if (!siteDomain) {
        sendTextMessage(say, thread_ts, ':warning: Please provide a valid site domain.');
        return;
      }

      const site = await getSiteMetadataByDomain(siteDomain);

      if (!site) {
        await say(`:x: No site found with the domain '${siteDomain}'.`);
        return;
      }

      const isLive = !site.isLive;

      const updatedSite = {
        isLive,
      };

      await updateSite(site._id, updatedSite);
      invalidateCache(); // meh

      let message = `:white_check_mark: Successfully updated the live status of the site '${siteDomain}'.\n\n`;
      message += isLive
        ? `:rocket: _Site is now set to live!'._\n\n`
        : ':submarine: _Site is now set to development!_\n\n';

        sendTextMessage(say, thread_ts, message);

    } catch (error) {
      await postErrorMessage(say, thread_ts, error);
    }
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    handleExecution,
  };
}

module.exports = SetLiveStatusCommand;
