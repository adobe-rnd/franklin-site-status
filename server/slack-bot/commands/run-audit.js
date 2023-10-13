const BaseCommand = require('./base-command.js');
const { getSiteMetadataByDomain, createSite } = require('../../db.js');
const { queueSiteToAudit } = require('../../queue.js');
const { invalidateCache } = require('../../cache.js');
const { postErrorMessage, sendTextMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');

const PHRASES = ['run audit'];

/**
 * Factory function to create the RunAuditCommand object.
 * @param {Object} bot - The bot instance.
 * @returns {Object} The RunAuditCommand object.
 */
function RunAuditCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'run-audit',
    name: 'Run Audit',
    description: 'Run audit for a previously added site',
    phrases: PHRASES,
    usageText: `${PHRASES[0]} {site}`,
  });

  /**
   * Validates input, fetches the site
   * and triggers a new audit for the given site
   *
   * @param {string[]} args - The arguments provided to the command ([site]).
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async ({args, thread_ts, say}) => {
    try {
      const [siteDomainInput] = args;

      const siteDomain = extractDomainFromInput(siteDomainInput, false);

      if (!siteDomain) {
        sendTextMessage(say, thread_ts, ':warning: Please provide a valid site domain.');
        return;
      }

      const site = await getSiteMetadataByDomain(siteDomain);

      if (!site) {
        sendTextMessage(say, thread_ts, `:x: '${siteDomain}' was not added previously. You can run '@spacecat add site ${siteDomain}`);
        return;
      }

      await queueSiteToAudit({
        _id: site._id,
      })

      let message = `:white_check_mark: Audit check is triggered for ${siteDomain}\n`
      message += `:adobe-run: In a minute, you can run@spacecat get site ${siteDomain}`;

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

module.exports = RunAuditCommand;
