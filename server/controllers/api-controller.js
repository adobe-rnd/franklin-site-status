const getCachedSitesWithAudits = require('../cache');
const exporters = require('../utils/exportUtils.js');
const { getSiteByDomain } = require('../db');
const { extractAuditScores, extractTotalBlockingTime, extractThirdPartySummary } = require('../utils/auditUtils.js');

/**
 * Provides a specific site's status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {Object} JSON response with site's status.
 * @throws {Error} If the site is not found.
 */
async function getSite(req, res, next) {
  const domain = req.params.domain;

  try {
    const site = await getSiteByDomain(domain);

    if (!site) {
      const error = new Error('Site not found');
      error.status = 404;
      throw error;
    }

    const audits = site.audits.map(audit => ({
      auditedAt: audit.auditedAt,
      isError: audit.isError,
      isLive: audit.isLive,
      markdownContent: audit.markdownContent,
      markdownDiff: audit.markdownDiff,
      githubDiff: audit.githubDiff,
      errorMessage: audit.errorMessage,
      scores: extractAuditScores(audit),
    }));

    const response = {
      domain,
      gitHubURL: site.gitHubURL,
      lastAudited: site.lastAudited,
      isLive: site.isLive,
      prodURL: site.prodURL,
      audits,
      auditError: audits[0]?.isError ? audits[0].errorMessage : null,
    };

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * Provides all sites' status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {Object} JSON response with all sites' status.
 * @throws {Error} If there is a problem retrieving the data.
 */
async function getSites(req, res, next) {
  try {
    const sites = await getCachedSitesWithAudits();
    const transformedData = exporters.transformSitesData(sites);

    return res.json(transformedData);
  } catch (err) {
    next(err);
  }
}

/**
 * Exports all sites.
 *
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @param {Function} exportFunction - Function to generate the file to be exported.
 * @param {string} mimeType - The MIME type of the file to be exported.
 * @param {string} filename - The name of the file to be exported.
 * @throws {Error} If there is a problem exporting the data.
 */
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

/**
 * Exports all sites to Excel.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
async function exportSitesToExcel(req, res, next) {
  await exportSites(res, next, exporters.exportSitesToExcel, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'franklin-site-status.xlsx');
}

/**
 * Exports all sites to CSV.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
async function exportSitesToCSV(req, res, next) {
  await exportSites(res, next, exporters.exportSitesToCSV, 'text/csv', 'franklin-site-status.csv');
}

/**
 * Provides martech impact report for a given site
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {Object} JSON response with site's status.
 * @throws {Error} If the site is not found.
 */
async function getMartechImpact(req, res, next) {
  const domain = req.params.domain;

  try {
    const site = await getSiteByDomain(domain);

    if (!site) {
      const error = new Error('Site not found');
      error.status = 404;
      throw error;
    }

    const lastAudit = site.audits[0]?.auditResult?.audits;

    const response = {
      domain,
      gitHubURL: site.gitHubURL,
      lastAudited: site.lastAudited,
      isLive: site.isLive,
      prodURL: site.prodURL,
      auditError: site.audits[0]?.isError ? site.audits[0].errorMessage : null,
      totalBlockingTime: extractTotalBlockingTime(lastAudit),
      thirdPartySummary: extractThirdPartySummary(lastAudit),
    }

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportSitesToCSV,
  exportSitesToExcel,
  getMartechImpact,
  getSite,
  getSites,
};
