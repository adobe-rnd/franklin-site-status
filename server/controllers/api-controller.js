const getCachedSitesWithAudits = require('../cache');
const exporters = require('../utils/exportUtils.js');
const { getSiteStatus } = require('../db');
const { extractAuditScores } = require('../utils/auditUtils.js');

async function getSite(req, res, next) {
  const domain = req.params.domain;

  try {
    const site = await getSiteStatus(domain);

    if (!site) {
      const error = new Error('Site not found');
      error.status = 404;
      throw error;
    }

    const audits = site.audits.map(audit => ({
      auditedAt: audit.auditedAt,
      isError: audit.isError,
      errorMessage: audit.errorMessage,
      scores: extractAuditScores(audit),
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
    next(err);
  }
}

async function getSites(req, res, next) {
  try {
    const sites = await getCachedSitesWithAudits();
    const transformedData = exporters.transformSitesData(sites);

    return res.json(transformedData);
  } catch (err) {
    next(err);
  }
}

async function exportSites(res, next, exportFunction, mimeType, filename) {
  try {
    const file = await exportFunction();

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', mimeType);
    res.send(file);
  } catch (err) {
    console.error(err);
    next(err);
  }
}

async function exportSitesToExcel(req, res, next) {
  await exportSites(res, next, exporters.exportSitesToExcel, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'franklin-site-status.xlsx');
}

async function exportSitesToCSV(req, res, next) {
  await exportSites(res, next, exporters.exportSitesToCSV, 'text/csv', 'franklin-site-status.csv');
}

module.exports = {
  exportSitesToCSV,
  exportSitesToExcel,
  getSite,
  getSites,
};
