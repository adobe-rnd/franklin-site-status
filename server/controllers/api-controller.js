const { getSiteStatus, getSitesWithAudits } = require('../db');

async function getSite(req, res) {
  const domain = req.params.domain;

  try {
    const site = await getSiteStatus(domain);

    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const audits = site.audits.map(audit => ({
      auditedAt: audit.auditedAt,
      isError: audit.isError,
      errorMessage: audit.errorMessage,
      scores: audit.auditResult ? {
        performance: audit.auditResult.categories.performance.score,
        accessibility: audit.auditResult.categories.accessibility.score,
        bestPractices: audit.auditResult.categories['best-practices'].score,
        seo: audit.auditResult.categories.seo.score,
      } : {},
    }));

    const response = {
      domain,
      gitHubURL: site.gitHubURL,
      lastAudited: site.lastAudited,
      audits,
      auditError: audits[0]?.isError ? audits[0].errorMessage : null,
    };

    return res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch status:', error: err });
  }
}

async function getSites(req, res) {
  try {
    const sites = await getSitesWithAudits();

    return res.json(sites.map(({ domain, gitHubURL, lastAudited, latestAudit }) => ({
      domain,
      gitHubURL,
      lastAudited,
      scores: latestAudit && latestAudit.auditResult ? {
        performance: latestAudit.auditResult.categories.performance.score,
        accessibility: latestAudit.auditResult.categories.accessibility.score,
        bestPractices: latestAudit.auditResult.categories['best-practices'].score,
        seo: latestAudit.auditResult.categories.seo.score,
      } : {},
    })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sites: ', err });
  }
}

module.exports = {
  getSite,
  getSites,
};
