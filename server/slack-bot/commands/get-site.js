const BaseCommand = require('./base-command.js');
const { getSiteByDomain } = require('../../db.js');
const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatDate, formatScore, printSiteDetails } = require('../../utils/formatUtils.js');
const { extractDomainFromInput, sendMessageBlocks, postErrorMessage } = require('../../utils/slackUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const PHRASES = ['get site', 'get domain'];

/**
 * Formats a single row of the table, padding each cell according to the column widths.
 *
 * @param {Array<string>} row - An array of strings, each representing a cell in the row.
 * @param {Array<number>} columnWidths - An array of numbers, each representing the maximum width of a column.
 * @returns {string} The formatted row.
 */
function formatRows(row, columnWidths, headers) {
  return row.map((cell, i) => {
    const cellStr = cell || '';
    // If the row has fewer columns than headers, pad the last cell to fill the remaining space
    const padding = (row.length < headers.length && i === row.length - 1) ? columnWidths.slice(i).reduce((a, b) => a + b, 0) : columnWidths[i];
    return cellStr.padEnd(padding + (i === 0 ? 0 : 2));
  }).join("  ");
}

/**
 * Formats an array of audits into a stringified table format. If audits are not provided or the array is empty,
 * it returns a fallback message. If the formatted table exceeds the character limit, it is sliced and appended
 * with an ellipsis.
 *
 * @param {Array<Object>} audits - An array of audit objects.
 * @returns {string} The audits formatted into a stringified table or a fallback message.
 */
function formatAudits(audits) {
  if (!audits || !audits.length) {
    return "No audit history available";
  }

  const headers = ["Audited At (UTC)", "Perf.", "SEO", "A11y", "Best Pr.", "Live"];
  const rows = audits.map(audit => {
    const { auditedAt, errorMessage, isError } = audit;

    if (isError) {
      return [formatDate(auditedAt), `Error: ${errorMessage}`];
    } else {
      const { performance, seo, accessibility, bestPractices } = extractAuditScores(audit);
      return [
        formatDate(auditedAt),
        formatScore(performance),
        formatScore(seo),
        formatScore(accessibility),
        formatScore(bestPractices),
        audit.isLive ? "Yes" : "No",
      ];
    }
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

  const formattedTable = `${BACKTICKS}\n${table.map(row => formatRows(row, columnWidths, headers)).join("\n")}\n${BACKTICKS}`;

  // Ensure the formattedTable string does not exceed the Slack message character limit.
  return formattedTable.length > CHARACTER_LIMIT ? `${formattedTable.slice(0, CHARACTER_LIMIT)}...` : formattedTable;
}

/**
 * A factory function that creates an instance of the GetSiteCommand.
 *
 * @param {Object} bot - The bot object.
 * @returns {Object} An instance of the GetSiteCommand.
 */
function GetSiteCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'get-franklin-site-status',
    name: "Get Franklin Site Status",
    description: 'Retrieves audit status for a Franklin site by a given domain',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {domain};`,
  });

  /**
   * Executes the GetSiteCommand. Retrieves the audit status for a site by a given domain and communicates the status back via
   * the provided say function. If an error occurs during execution, an error message is sent back.
   *
   * @param {Array<string>} args - The arguments provided to the command.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const handleExecution = async (args, say) => {
    try {
      const [domainInput] = args;
      const domain = extractDomainFromInput(domainInput, false);

      if (!domain) {
        await say(baseCommand.usage());
        return;
      }

      await say(`:hourglass: Retrieving status for domain: ${domain}, please wait...`);

      const site = await getSiteByDomain(domain);

      if (!site) {
        await say(`:warning: No site found with domain: ${domain}`);
        return;
      }

      const textSections = [{
        text: `
    *Franklin Site Status*:

${printSiteDetails(site)}

    _Audits are sorted by date descending._\n${formatAudits(site.audits)}
  `,
      }];

      await sendMessageBlocks(say, textSections);
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

module.exports = GetSiteCommand;
