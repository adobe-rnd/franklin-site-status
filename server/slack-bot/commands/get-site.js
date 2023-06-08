const BaseCommand = require('./base-command.js');
const { getSiteByDomain } = require('../../db.js');
const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatDate, formatScore } = require('../../utils/formatUtils.js');
const { extractDomainFromInput, sendMessageBlocks, postErrorMessage } = require('../../utils/slackUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const PHRASES = ['get domain', 'get site with domain'];

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

  const headers = ["Audited At (UTC)", "Performance", "SEO", "Accessibility", "Best Practices"];
  const rows = audits.map(audit => {
    const { auditedAt, errorMessage, isError } = audit;

    if (isError) {
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
  const columnWidths = table[0].map((_, i) => Math.max(...table.map(row => (row[i] || '').length)));

  const formattedTable = `${BACKTICKS}\n${table.map(row => formatRows(row, columnWidths)).join("\n")}\n${BACKTICKS}`;

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
      const domain = extractDomainFromInput(domainInput);

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

      const psiURL = `https://developers.google.com/speed/pagespeed/insights/?url=${site.domain}&strategy=mobile`;
      const psiProdURL = site.isLive && site.prodDomain ? `https://developers.google.com/speed/pagespeed/insights/?url=${site.prodDomain}&strategy=mobile` : null;

      const textSections = [{
        text: `
    *Franklin Site Status*: 
    :mars-team: Franklin .live Domain: ${site.domain}
    ${site.prodDomain ? `:earth_americas: Production Domain: ${site.prodDomain}` : ''}
    :github-4173: GitHub: ${site.gitHubURL}
    ${site.isLive ? ':white_check_mark:' : ':x:'} Is Live: ${site.isLive ? 'Yes' : 'No'}
    :lighthouse: <${psiURL}|Run PSI (.live)> ${psiProdURL ? ` | <${psiProdURL}|Run PSI (Prod)>` : ''}
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
    handleExecution,
  };
}

module.exports = GetSiteCommand;
