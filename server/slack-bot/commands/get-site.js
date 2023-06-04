const { URL } = require('url');

const BaseCommand = require('./base-command.js');
const { getSiteStatus } = require('../../db.js');
const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatDate, formatScore, getLastWord } = require('../../utils/formatUtils.js');
const { sendMessageBlocks } = require('../../utils/slackUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const LINKED_REGEX = /<([^|>]+)\|[^>]+>/;
const PADDING_EXTRA_SPACE = 2;
const PHRASES = ['get domain', 'get site with domain'];

function formatAudits(audits) {
  if (!Array.isArray(audits)) {
    return "No audit history available";
  }

  const headers = ["Audited At (UTC)", "Performance", "SEO", "Accessibility", "Best Practices"];
  const rows = audits.map((audit) => {
    const { auditedAt, errorMessage, isError } = audit;

    if (!isError) {
      const { performance, seo, accessibility, bestPractices } = extractAuditScores(audit);
      return [
        formatDate(auditedAt),
        formatScore(performance),
        formatScore(seo),
        formatScore(accessibility),
        formatScore(bestPractices),
      ];
    } else {
      return [formatDate(auditedAt), errorMessage, "", "", ""];
    }
  });

  const table = [headers, ...rows];
  const columnWidths = table.reduce((widths, row) => {
    return row.map((cell, i) => {
      const colSpan = row.length === 2 && i === 1 ? 4 : 1;
      return Math.max(widths[i] || 0, cell.length / colSpan);
    });
  }, []);

  let formattedTable = table
    .map((row) => {
      return row.map((cell, i) => {
        if (i === 0) {
          return cell.padEnd(columnWidths[i]);
        } else if (row.length === 2 && i === 1) {
          return cell.padEnd(columnWidths[i] * 4);
        } else {
          return cell.padEnd(columnWidths[i] + PADDING_EXTRA_SPACE);
        }
      }).join("  ");
    })
    .join("\n");

  // ensure the formattedTable string does not exceed the character limit.
  // this is mostly due to the 3001 character limit of slack messages.
  if (formattedTable.length > CHARACTER_LIMIT) {
    formattedTable = formattedTable.slice(0, CHARACTER_LIMIT) + '...';
  }

  return `${BACKTICKS}\n${formattedTable}\n${BACKTICKS}`;
}

function extractDomainFromInput(message) {
  const input = getLastWord(message);

  if (!input) {
    return null;
  }

  const linkedFormMatch = input.match(LINKED_REGEX);

  if (linkedFormMatch) {
    return new URL(linkedFormMatch[1]).hostname;
  } else {
    return input.trim();
  }
}

function GetSiteCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'get-franklin-site-status',
    name: "Get Franklin Site Status",
    description: 'Retrieves audit status for a franklin site by a given domain',
    phrases: PHRASES,
    usage: `${PHRASES.join(' or ')} {domain};`,
  });

  const execute = async (message, say) => {
    const domain = extractDomainFromInput(message);

    if (!domain) {
      await say(usage());
      return;
    }

    await say(`:hourglass: Retrieving status for domain: ${domain}, please wait...`);

    const site = await getSiteStatus(domain);

    if (!site) {
      await say(`:warning: No site found with domain: ${domain}`);
      return;
    }

    let textSections = [{
      text: `
    *Franklin Site Status*: ${site.domain}
    :github-4173: GitHub: ${site.gitHubURL}
    :clock1: Last audit on ${formatDate(site.lastAudited)}

    _Audits are sorted by date descending._\n${formatAudits(site.audits)}
    `,
    }];

    await sendMessageBlocks(say, textSections);
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    execute,
  };
}

module.exports = GetSiteCommand;
