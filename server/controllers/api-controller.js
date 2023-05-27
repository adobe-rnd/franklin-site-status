const { getSiteStatus, getSitesWithAudits } = require('../db');

async function getStatus(req, res) {
  const domain = req.params.domain;

  try {
    const site = await getSiteStatus(domain);

    if (!site) {
      return res.json({ error: 'Site not found' });
    }

    console.log(JSON.stringify(site, null, 2));

    const { auditHistory, githubUrl, lastAudited } = site;
    const latestAudit = auditHistory?.[0] ?? {};

    const response = {
      domain,
      githubUrl,
      lastAudited,
      auditHistory,
      auditError: latestAudit.isError ? latestAudit.errorMessage : null,
    };

    return res.json(response);
  } catch (err) {
    res.json({ message: 'Failed to fetch status:', error: err });
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
