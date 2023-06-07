const BaseCommand = require('./base-command.js');
const { getSiteStatus } = require('../../db.js');
const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatDate, formatScore, getLastWord } = require('../../utils/formatUtils.js');
const { extractDomainFromInput, sendMessageBlocks, postErrorMessage } = require('../../utils/slackUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const PADDING_EXTRA_SPACE = 2;
const PHRASES = ['get domain', 'get site with domain'];

/**
 * Formats a single row of the table, padding each cell according to the column widths.
 *
 * @param {Array} row - An array of strings, each representing a cell in the row.
 * @param {Array} columnWidths - An array of numbers, each representing the maximum width of a column.
 * @returns {string} The formatted row.
 */
function formatRows(row, columnWidths) {
  return row.map((cell, i) => {
    if (i === 0) {
      return cell.padEnd(columnWidths[i]);
    } else if (row.length === 2 && i === 1) {
      return cell.padEnd(columnWidths[i] * 4);
    } else {
      return cell.padEnd(columnWidths[i] + PADDING_EXTRA_SPACE);
    }
  }).join("  ");
}

/**
 * Formats an array of audits into a stringified table format. If audits are not provided or the array is empty,
 * it returns a fallback message. If the formatted table exceeds the character limit, it is sliced and appended
 * with an ellipsis.
 *
 * @param {Array} audits - An array of audit objects.
 * @returns {string} The audits formatted into a stringified table or a fallback message.
 */
function formatAudits(audits) {
  if (!Array.isArray(audits)) {
    return "No audit history available";
  }

  const headers = ["Audited At (UTC)", "Performance", "SEO", "Accessibility", "Best Practices"];
  const rows = audits.map((audit) => {
    const { auditedAt, errorMessage, isError } = audit;

    if (isError) {
      // When isError is true, return only two columns
      return [formatDate(auditedAt), errorMessage];
    } else {
      const { performance, seo, accessibility, bestPractices } = extractAuditScores(audit);
      return [
        formatDate(auditedAt),
        formatScore(performance),
        formatScore(seo),
        formatScore(accessibility),
        formatScore(bestPractices),
      ];
    }
  });

  const table = [headers, ...rows];
  const columnWidths = table.reduce((widths, row) => {
    return row.map((cell, i) => {
      // if the row has only 2 elements (colspan case), and the cell is not the first one
      const colSpan = row.length === 2 && i !== 0 ? 4 : 1;
      // Ignore columns that are part of a colspanned cell
      if (colSpan > 1 && i !== 0) {
        return widths[i] || 0;
      }
      return Math.max(widths[i] || 0, cell.length / colSpan);
    });
  }, []);


  let formattedTable = table
    .map((row) => formatRows(row, columnWidths))
    .join("\n");

  // ensure the formattedTable string does not exceed the character limit.
  // this is mostly due to the 3001 character limit of slack messages.
  if (formattedTable.length > CHARACTER_LIMIT) {
    formattedTable = formattedTable.slice(0, CHARACTER_LIMIT) + '...';
  }

  return `${BACKTICKS}\n${formattedTable}\n${BACKTICKS}`;
}

/**
 * A factory function that creates an instance of the GetSiteCommand. The instance includes an `execute` method
 * that retrieves the audit status for a Franklin site by a given domain and communicates the status back via
 * the provided `say` function. If an error occurs during execution, an error message is sent back.
 *
 * @param {Object} bot - The bot object.
 * @returns {Object} An instance of the GetSiteCommand.
 */
function GetSiteCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'get-franklin-site-status',
    name: "Get Franklin Site Status",
    description: 'Retrieves audit status for a franklin site by a given domain',
    phrases: PHRASES,
    usageText: `${PHRASES.join(' or ')} {domain};`,
  });

  /**
   * Execute function for GetSiteCommand. This function extracts the domain from the incoming message,
   * retrieves the site status from the database using the domain, and responds back to the user with
   * either the site status or an error message if the domain was not found.
   *
   * @param {Object} message - The incoming message object from the bot.
   * @param {Function} say - The function provided by the bot to send messages.
   * @returns {Promise} A promise that resolves when the operation is complete.
   */
  const execute = async (message, say) => {
    try {
      const domain = extractDomainFromInput(message);

      if (!domain) {
        await say(baseCommand.usage());
        return;
      }

      await say(`:hourglass: Retrieving status for domain: ${domain}, please wait...`);

      const site = await getSiteStatus(domain);

      if (!site) {
        await say(`:warning: No site found with domain: ${domain}`);
        return;
      }

      const psiURL = `https://developers.google.com/speed/pagespeed/insights/?url=${site.domain}&strategy=mobile`;

      let textSections = [{
        text: `
      *Franklin Site Status*: ${site.domain}
      :github-4173: GitHub: ${site.gitHubURL}
      :lighthouse: <${psiURL}|Run PSI>
      :clock1: Last audit on ${formatDate(site.lastAudited)}

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
    execute,
  };
}

module.exports = GetSiteCommand;
