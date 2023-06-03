const getCachedSitesWithAudits = require('../../cache.js');
const { extractAuditScores } = require('../../utils/auditUtils.js');
const { formatScore } = require('../../utils/formatUtils.js');

const BACKTICKS = '```';
const CHARACTER_LIMIT = 2500;
const PHRASES = ['get sites', 'get all sites'];

const formatSites = (sites) => {
  const formattedSites = sites.map((site, index) => {
    const { domain } = site;

    if (site.audits.length === 0) {
      return `${String(index + 1).padStart(2, '0')}: No audits found for ${domain}`;
    }

    const scores = extractAuditScores(site.audits[0]);
    const { performance = 0, accessibility = 0, bestPractices = 0, seo = 0 } = scores;

    const siteMessage = `${String(index + 1).padStart(2, '0')}: ${formatScore(performance)} - ${formatScore(seo)} - ${formatScore(accessibility)} - ${formatScore(bestPractices)} >> ${domain}`;

    return siteMessage.trim();
  });

  // ensure the sitesMessage string does not exceed the character limit.
  // this is mostly due to the 3001 character limit of slack messages.
  const sitesMessage = formattedSites.join('\n').slice(0, CHARACTER_LIMIT) + '...';

  return `${BACKTICKS}${sitesMessage}${BACKTICKS}`;
};

const accepts = (message) => {
  return PHRASES.some(phrase => message.startsWith(phrase));
};

const execute = async (message, say) => {
  const sites = await getCachedSitesWithAudits();

  await say('Retrieving all sites, please wait :hourglass:');

  if (sites.length === 0) {
    await say(':warning: No sites found.');
    return;
  }

  const totalSites = sites.length;

  let blocks = [{
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `
*Franklin Sites Status:* ${totalSites} total sites

Columns: Index: Performance - SEO - Accessibility - Best Practices >> Domain
_Sites are ordered by performance score, then all other scores, descending._
${formatSites(sites)} 
      `,
    }
  }];

  await say({ blocks });
};

const usage = () => {
  return `Usage: _${PHRASES.join(' or ')}_`;
};

module.exports = {
  name: "Get All Franklin Sites",
  description: 'Retrieves all known franklin sites and includes the latest audit scores',
  phrases: PHRASES,
  accepts,
  execute,
  usage,
};
