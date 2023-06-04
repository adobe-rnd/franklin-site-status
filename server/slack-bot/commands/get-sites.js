const exporters = require('../../utils/exportUtils.js');
const getCachedSitesWithAudits = require('../../cache.js');

const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatScore } = require('../../utils/formatUtils.js');

const PAGE_SIZE = 20;
const PHRASES = ['get sites', 'get all sites'];

const formatSites = (sites, start, end) => {
  const sitesMessage = sites.slice(start, end).reduce((message, site, index) => {
    const { domain } = site;
    const rank = start + index + 1;

    let siteMessage = `${rank}. No audits found for ${domain}`;

    if (site.audits.length !== 0) {
      const lastAudit = site.audits[0];

      if (!lastAudit.isError) {
        const scores = extractAuditScores(lastAudit);
        const { performance = 0, accessibility = 0, bestPractices = 0, seo = 0 } = scores;

        siteMessage = `${rank}. ${formatScore(performance)} - ${formatScore(seo)} - ${formatScore(accessibility)} - ${formatScore(bestPractices)}: <https://${domain}|${domain}>`;
      } else {
        siteMessage = `${rank}. :warning: audit error (site has 404 or other): <https://${domain}|${domain}>`;
      }
    }

    return message + '\n' + siteMessage.trim();
  }, '');

  return `${sitesMessage}`;
};

const generateOverflowAccessory = () => {
  return {
    "type": "overflow",
    "options": [
      {
        "text": {
          "type": "plain_text",
          "text": ":page_facing_up: Download as CSV",
          "emoji": true
        },
        "value": "csv"
      },
      {
        "text": {
          "type": "plain_text",
          "text": ":excel: Download as XLS",
          "emoji": true
        },
        "value": "xlsx"
      },
    ],
    "action_id": "sites_overflow_action"
  };
};

const generatePaginationBlocks = (start, end, totalSites) => {
  const blocks = [];
  const numberOfPages = Math.ceil(totalSites / PAGE_SIZE);

  // add 'Previous' button if not on first page
  if (start > 0) {
    blocks.push({
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": "Previous"
      },
      "value": String(start - PAGE_SIZE),
      "action_id": "paginate_sites_prev"
    });
  }

  // add numbered page buttons
  for (let i = 0; i < numberOfPages; i++) {
    const pageStart = i * PAGE_SIZE;
    blocks.push({
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": `${i + 1}`
      },
      "value": String(pageStart),
      "action_id": `paginate_sites_page_${i + 1}`
    });
  }

  // add 'Next' button if not on last page
  if (end < totalSites) {
    blocks.push({
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": "Next"
      },
      "value": String(start + PAGE_SIZE),
      "action_id": "paginate_sites_next"
    });
  }

  return {
    "type": "actions",
    "elements": blocks
  };
};

const overflowActionHandler = async ({ body, ack, client, say }) => {
  await ack();

  const selectedOption = body.actions?.[0]?.selected_option?.value;

  if (!selectedOption) {
    await say(`:nuclear-warning: Oops! No format selected. Please select either 'csv' or 'xlsx'.`);
    return;
  }

  if (selectedOption !== 'csv' && selectedOption !== 'xlsx') {
    await say(`:nuclear-warning: Oops! The selected format '${selectedOption}' is not supported. Please select either 'csv' or 'xlsx'.`);
    return;
  }

  await say(':hourglass: Preparing the requested export for you, please wait...');

  try {
    let fileBuffer;
    if (selectedOption === 'csv') {
      fileBuffer = await exporters.exportSitesToCSV();
    } else if (selectedOption === 'xlsx') {
      fileBuffer = await exporters.exportSitesToExcel();
    }

    await client.files.uploadV2({
      channels: body.channel.id,
      file: fileBuffer,
      filename: `franklin-site-status.${selectedOption}`,
      title: `Franklin Site Status Export (${selectedOption.toUpperCase()})`,
      initial_comment: ':tada: Here is an export of all sites and their audit scores.'
    });
  } catch (error) {
    await say(`:nuclear-warning: Oops! Something went wrong: ${error.message}`);
    console.error(error);
  }
};


const paginationHandler = async ({ ack, say, action }) => {
  await ack();

  const start = parseInt(action.value);
  const end = start + PAGE_SIZE;

  const sites = await getCachedSitesWithAudits();
  const totalSites = sites.length;

  let blocks = [{
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": formatSites(sites, start, end)
    }
  }];

  blocks.push(generatePaginationBlocks(start, end, totalSites));

  await say({ blocks });
};

const accepts = (message) => {
  return PHRASES.some(phrase => message.includes(phrase));
};

const execute = async (message, say) => {
  await say(':hourglass: Retrieving all sites, please wait...');

  const sites = await getCachedSitesWithAudits();

  if (sites.length === 0) {
    await say(':warning: No sites found.');
    return;
  }

  const totalSites = sites.length;
  const start = 0;
  const end = start + PAGE_SIZE;

  let blocks = [{
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `
*Franklin Sites Status:* ${totalSites} total sites

Columns: Rank: Performance - SEO - Accessibility - Best Practices >> Domain
_Sites are ordered by performance score, then all other scores, descending._
${formatSites(sites, start, end)} 
      `,
    },
    "accessory": generateOverflowAccessory(),
  }];

  blocks.push(generatePaginationBlocks(start, end, totalSites));

  await say({ blocks });
};

const usage = () => {
  return `Usage: _${PHRASES.join(' or ')}_`;
};

const init = (bot) => {
  bot.action('sites_overflow_action', overflowActionHandler);
  bot.action(/^paginate_sites_(prev|next|page_\d+)$/, paginationHandler);
};

module.exports = (bot) => {
  init(bot);

  return {
    name: "Get All Franklin Sites",
    description: 'Retrieves all known franklin sites and includes the latest audit scores',
    phrases: PHRASES,
    accepts,
    execute,
    usage,
  }
};
