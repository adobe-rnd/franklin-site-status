const { getSiteStatus, getSitesWithAudits, getWorkerRunningState } = require('../db');

async function getStatus(req, res) {
  const domain = req.params.domain;

  try {
    const site = await getSiteStatus(domain);

    if (!site || !site.latestAudit.length) {
      return res.json({ error: 'Site not found or no audits found for site' });
    }

    const { githubUrl, latestAudit: [latestAudit] } = site;

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

    return res.json(sites.map(({ domain, gitHubURL, isError, errorMessage, scores }) => ({
      domain,
      gitHubURL,
      ...(isError ? { auditError: errorMessage } : { scores })
    })));
  } catch (err) {
    res.json({ message: 'Failed to fetch sites.' });
  }
}

async function triggerImport(req, res) {
  try {
    const importWorkerRunning = await getWorkerRunningState('importWorker');

    if (importWorkerRunning) {
      return res.json({ message: 'Import is already running.' });
    }

    const workerResponse = await axios.post('http://import-worker:3000/start');

    if (workerResponse.status === 200) {
      return res.json({ message: 'Import started.' });
    }

    res.json({ message: 'Failed to start import.' });
  } catch (err) {
    res.json({ message: 'Failed to trigger import.' });
  }
}

module.exports = {
  getStatus,
  getSites,
  triggerImport,
};
