const { getSiteStatus, getSitesWithAudits } = require('../db');

async function getStatus(req, res) {
  const domain = req.params.domain;

  try {
    const site = await getSiteStatus(domain);

    if (!site || !site.latestAudit.length) {
      return res.json({ error: 'Site not found or no audits found for site' });
    }

    const { githubUrl, latestAudit: [latestAudit], lastAudited } = site;

    if (latestAudit.isError) {
      return res.json({
        domain,
        githubUrl,
        auditError: latestAudit.error
      });
    }

    const {
      'performance': performance,
      'accessibility': accessibility,
      'best-practices': bestPractices,
      'seo': seo
    } = latestAudit.auditResult.categories;

    return res.json({
      domain,
      githubUrl,
      lastAudited,
      scores: {
        performance: performance.score,
        accessibility: accessibility.score,
        bestPractices: bestPractices.score,
        seo: seo.score
      }
    });
  } catch (err) {
    res.json({ error: err });
  }
}


async function getSites(req, res) {
  try {
    const sites = await getSitesWithAudits();

    return res.json(sites.map(({
                                 domain,
                                 gitHubURL,
                                 isError,
                                 errorMessage,
                                 lastAudited,
                                 scores,
                                 totalAudits,
                               }) => ({
      domain,
      gitHubURL,
      lastAudited,
      totalAudits,
      ...(isError ? { auditError: errorMessage } : { scores }),
    })));
  } catch (err) {
    res.json({ message: 'Failed to fetch sites: ', err });
  }
}

module.exports = {
  getStatus,
  getSites,
};
