const BaseCommand = require('./base-command.js');
const { getSiteMetadataByDomain, createSite } = require('../../db.js');
const { queueSiteToAudit } = require('../../queue.js');
const { invalidateCache } = require('../../cache.js');
const { postErrorMessage, extractDomainFromInput } = require('../../utils/slackUtils.js');

const PHRASES = ['add site'];

/**
 * Factory function to create the AddSiteCommand object.
 * @param {Object} bot - The bot instance.
 * @returns {Object} The AddSiteCommand object.
 */
function AddSiteCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'add-site',
    name: 'Add Site',
    description: 'Adds a new site to track.',
    phrases: PHRASES,
    usageText: `${PHRASES[0]} {site}`,
  });

  /**
   * Validates input and adds the site to db
   * Runs an initial audit for the added domain
   *
   * @param {string[]} args - The arguments provided to the command ([site]).
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, say) => {
    try {
      const [siteDomainInput] = args;

      const siteDomain = extractDomainFromInput(siteDomainInput, false);

      if (!siteDomain) {
        await say(':warning: Please provide a valid site domain.');
        return;
      }

      const site = await getSiteMetadataByDomain(siteDomain);

      if (site) {
        await say(`:x: '${siteDomain}' was already added before. You can run _@spacecat get site ${siteDomain}_`);
        return;
      }

      const newSite = {
        domain: siteDomain,
        updatedAt: new Date(),
      };

      const result = await createSite(newSite);
      if (!result || result.insertedCount !== 1) {
        await say(`:x: Problem adding the site. Please contact the admins.`);
        return;
      }

      invalidateCache(); // meh
      const siteId = result.insertedId;
      await queueSiteToAudit({
        _id: siteId,
      })

      let message = `:white_check_mark: Successfully added new site '${siteDomain}'.\n`
      message += `First PSI check is triggered! :adobe-run:'\n`
      message += `In a minute, you can run _@spacecat get site ${siteDomain}_`;

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

module.exports = AddSiteCommand;
