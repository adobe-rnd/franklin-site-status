const { getSiteStatus, getSitesWithAudits } = require('../db');
const { generateExcel, generateCsv, selectPropertiesForObject } = require('../utils/exportUtils');

function extractAuditScores(audit) {
  if (!audit || !audit.auditResult) return {};

  const { performance, accessibility, 'best-practices': bestPractices, seo } = audit.auditResult.categories;
  return {
    performance: performance.score,
    accessibility: accessibility.score,
    bestPractices: bestPractices.score,
    seo: seo.score
  };
}

function transformSitesData(sites) {
  return sites.map(({ domain, gitHubURL, lastAudit }) => {
    const auditInfo = lastAudit ? {
      auditedAt: lastAudit.auditedAt,
      isError: lastAudit.isError,
      errorMessage: lastAudit.errorMessage,
      scores: extractAuditScores(lastAudit),
    } : null;

    return {
      domain,
      gitHubURL,
      lastAudit: auditInfo,
    };
  });
}

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
    const sites = await getSitesWithAudits();
    const transformedData = transformSitesData(sites);

    return res.json(transformedData);
  } catch (err) {
    next(err);
  }
}

const SITES_EXPORT_PROPERTIES = [
  { name: 'domain', path: 'domain' },
  { name: 'gitHubURL', path: 'gitHubURL' },
  { name: 'performance', path: 'lastAudit.scores.performance' },
  { name: 'seo', path: 'lastAudit.scores.seo' },
  { name: 'accessibility', path: 'lastAudit.scores.accessibility' },
  { name: 'best-practices', path: 'lastAudit.scores.bestPractices' },
  { name: 'auditError', path: 'lastAudit.errorMessage', condition: (site) => site.lastAudit && site.lastAudit.isError },
];

async function exportSitesToExcel(req, res, next) {
  try {
    const sites = await getSitesWithAudits();
    const data = transformSitesData(sites);
    const dataForExport = data.map((site) => selectPropertiesForObject(site, SITES_EXPORT_PROPERTIES));
    const excel = generateExcel(dataForExport, 'franklin-site-status');

    res.setHeader('Content-Disposition', 'attachment; filename=franklin-site-status.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excel);

  } catch (err) {
    next(err);
  }
}

async function exportSitesToCSV(req, res, next) {
  try {
    const sites = await getSitesWithAudits();
    const data = transformSitesData(sites);
    const dataForExport = data.map((site) => selectPropertiesForObject(site, SITES_EXPORT_PROPERTIES));
    const csv = generateCsv(dataForExport);

    res.setHeader('Content-Disposition', 'attachment; filename=franklin-site-status.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);

  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportSitesToCSV,
  exportSitesToExcel,
  getSite,
  getSites,
};
