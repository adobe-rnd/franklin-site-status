import {SlackFunction} from "deno-slack-sdk/mod.ts";

import FormatSitesMessageDefinition from '../format_sites_message/definition.ts';

import {formatScore} from '../util.ts';

const BACKTICKS = '```';
const MAX_SITES = 30;

const formatSitesMessage = (sites: object[], totalSites: number, auditedSites: number) => {
    const formattedSites = sites.map((site, index) => {
    const { domain, gitHubURL, lastAudited, scores } = site;
    const { performance = 0, accessibility = 0, bestPractices = 0, seo = 0 } = scores;

    const siteMessage = `${String(index + 1).padStart(2, '0')}: ${formatScore(performance)} - ${formatScore(seo)} - ${formatScore(accessibility)} - ${formatScore(bestPractices)} >> ${domain}`;

    return siteMessage.trim();
  });

  const sitesMessage = formattedSites.join('\n');
  const summaryMessage = `
    *Total Sites:* ${totalSites}, of which ${auditedSites} have been audited

    Scores: Performance-SEO-Accessibility-Best Practices
    (results are ordered by Performance score, then all other scores, descending)
    
    Showing the top ${MAX_SITES} sites:
  `;

  return `${summaryMessage}\n${BACKTICKS}${sitesMessage}${BACKTICKS}`;
};

export default SlackFunction(
  FormatSitesMessageDefinition,
  async ({inputs}) => {
    let sites = inputs.sites;
    const totalSites = sites.length;

    if (sites.length === 0) {
      return {outputs: {message: ":warning: No sites were found."}}
    }

    sites = sites.filter(site => {
      const { performance = 0, accessibility = 0, bestPractices = 0, seo = 0 } = site.scores;

      // Exclude if all scores are 0
      if (performance === 0 && accessibility === 0 && bestPractices === 0 && seo === 0) {
        return false;
      }

      return true;
    });

    const auditedSites = sites.length;

    sites.sort((a, b) => {
      if (a.scores.performance !== b.scores.performance) {
        return a.scores.performance - b.scores.performance;
      }

      if (a.scores.seo !== b.scores.seo) {
        return a.scores.seo - b.scores.seo;
      }

      if (a.scores.accessibility !== b.scores.accessibility) {
        return a.scores.accessibility - b.scores.accessibility;
      }

      if (a.scores.bestPractices !== b.scores.bestPractices) {
        return a.scores.bestPractices - b.scores.bestPractices;
      }

      return 0;
    });


    const message = formatSitesMessage(sites.slice(0, MAX_SITES), totalSites, auditedSites);
    return {outputs: {message}};
  }
);
