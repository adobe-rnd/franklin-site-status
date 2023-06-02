import {SlackFunction} from "deno-slack-sdk/mod.ts";
import FormatSiteMessageDefinition from '../format_site_message/definition.ts';
import {formatDate, formatScore} from '../util.ts';

const PADDING_EXTRA_SPACE = 2;
const BACKTICKS = '```';


const formatAudits = (audits: object[] | null): string => {
  if (!Array.isArray(audits)) {
    return "No audit history available";
  }

  const headers = ["Audited At (UTC)", "Performance", "SEO", "Accessibility", "Best Practices"];
  const rows = audits.map((audit) => {
    const {auditedAt, scores, errorMessage} = audit;

    if (Object.keys(scores).length > 0) {
      const {performance, seo, accessibility, bestPractices} = scores;
      return [
        formatDate(auditedAt),
        formatScore(performance),
        formatScore(seo),
        formatScore(accessibility),
        formatScore(bestPractices),
      ];
    } else {
      return [auditedAt, errorMessage, "", "", ""];
    }
  });

  const table = [headers, ...rows];
  const columnWidths = table.reduce((widths, row) => {
    return row.map((cell, i) => {
      const colSpan = row.length === 2 && i === 1 ? 4 : 1;
      return Math.max(widths[i] || 0, cell.length / colSpan);
    });
  }, []);

  const formattedTable = table
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

  return `${BACKTICKS}\n${formattedTable}\n${BACKTICKS}`;
};

const formatSiteMessage = (site: object): string => {
  const formattedMessage = `
    *Domain:* ${site.domain}
    *Github URL:* <${site.githubUrl}>
    *Last Audit Date:* ${formatDate(site.lastAudited)}

    *Audit History:*
    ${formatAudits(site.audits)}
  `;
  return formattedMessage.trim();
};

export default SlackFunction(
  FormatSiteMessageDefinition,
  async ({inputs}) => {
    const site = inputs.site;

    if (!site.domain) {
      return {outputs: {message: ":warning: This site could not be found."}}
    }

    const message = formatSiteMessage(site);
    return {outputs: {message}};
  }
);
