const BaseCommand = require('./base-command.js');
const { getSiteByDomain } = require('../../db.js');
const { extractThirdPartySummary, extractTotalBlockingTime, extractLastAudit } = require('../../utils/auditUtils.js');
const { addEllipsis, formatSize, printSiteDetails } = require('../../utils/formatUtils.js');
const { extractDomainFromInput, sendTextMessage, sendMessageBlocks, postErrorMessage } = require('../../utils/slackUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const PHRASES = ['get martech impact', 'get third party impact'];

/**
 * Formats a single row of the table, padding each cell according to the column widths.
 *
 * @param {Array<string>} row - An array of strings, each representing a cell in the row.
 * @param {Array<number>} columnWidths - An array of numbers, each representing the maximum width of a column.
 * @returns {string} The formatted row.
 */
function formatRows(row, columnWidths) {
  return row.map((cell, i) =>
    cell.padEnd(columnWidths[i] + (i === 0 ? 0 : 2))
  ).join("  ");
}

function formatTotalBlockingTime(totalBlockingTime = []) {
  return totalBlockingTime || '_unknown_';
}

/**
 * Formats an array of third party sumary into a stringified table format. If summary array is empty,
 * it returns a fallback message. If the formatted table exceeds the character limit, it is sliced and appended
 * with an ellipsis.
 *
 * @param {Array<Object>} summary - An array of third party summary objects.
 * @returns {string} Third party summary formatted into a stringified table or a fallback message.
 */
function formatThirdPartySummary(summary = []) {
  if (summary.length === 0) {
    return "    _No third party impact detected_";
  }

  const headers = ["Third Party", "Main Thread", "Blocking", "Transfer"];
  const rows = summary.map(thirdParty => {
    const { entity, blockingTime, mainThreadTime, transferSize } = thirdParty;

    return [
      addEllipsis(entity),
      `${Math.round(mainThreadTime)} ms`,
      `${Math.round(blockingTime)} ms`,
      formatSize(transferSize),
    ];
  });

  const table = [headers, ...rows];
  const columnWidths = table.reduce((widths, row) => {
    const rowLength = row.length;
    return row.map((cell, i) => {
      const currentWidth = widths[i] || 0;
      const isColspanCase = rowLength === 2 && i !== 0;
      const colSpan = isColspanCase ? headers.length - 1 : 1;

      if (isColspanCase && i !== 0) {
        return currentWidth;
      }

      return Math.max(currentWidth, cell.length / colSpan);
    });
  }, []);

  const formattedTable = `${BACKTICKS}\n${table.map(row => formatRows(row, columnWidths)).join("\n")}\n${BACKTICKS}`;

  // Ensure the formattedTable string does not exceed the Slack message character limit.
  return formattedTable.length > CHARACTER_LIMIT ? `${formattedTable.slice(0, CHARACTER_LIMIT)}...` : formattedTable;
}

/**
 * A factory function that creates an instance of the MartechImpactCommand.
 *
 * @param {Object} bot - The bot object.
 * @returns {Object} An instance of the GetSiteCommand.
 */
function MartechImpactCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'get-franklin-site-martech-impact',
    name: "Get Franklin Site Martech Impact",
    description: 'Retrieves tbt and third party summary for a Franklin site by a given domain',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {domain};`,
  });

  /**
   * Executes the MartechImpactCommand. Retrieves the last tbt and third party summary audit status for a site
   * by a given domain and communicates the status back via the provided say function. If an error occurs during
   * execution, an error message is sent back.
   *
   * @param {Array<string>} args - The arguments provided to the command.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, thread_ts, say) => {
    try {
      const [domainInput] = args;
      const domain = extractDomainFromInput(domainInput, false);

      if (!domain) {
        sendTextMessage(say, thread_ts, baseCommand.usage());
        return;
      }
      sendTextMessage(say, thread_ts, `:hourglass: Retrieving status for domain: ${domain}, please wait...`);

      const site = await getSiteByDomain(domain);

      if (!site) {
        
        sendTextMessage(say, thread_ts, `:warning: No site found with domain: ${domain}`);
        return;
      }

      const lastAudit = extractLastAudit(site)?.auditResults?.mobile?.audits;
      const totalBlockingTime = extractTotalBlockingTime(lastAudit);
      const thirdPartySummary = extractThirdPartySummary(lastAudit);

      const textSections = [{
        text: `
    *Franklin Site Status*:

${printSiteDetails(site)}

    *Total Blocking Time (TBT):*\t${formatTotalBlockingTime(totalBlockingTime)}
    
    *Third Party Summary:*\n${formatThirdPartySummary(thirdPartySummary)}
  `,
      }];

      await sendMessageBlocks(say, thread_ts, textSections);
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

module.exports = MartechImpactCommand;
