const xlsx = require('xlsx');
const { Parser } = require('json2csv');

const getCachedSitesWithAudits = require('../cache.js');
const { extractAuditScores } = require('./auditUtils.js');

const SITES_EXPORT_PROPERTIES = [
  { name: 'domain', path: 'domain' },
  { name: 'gitHubURL', path: 'gitHubURL' },
  { name: 'isLive', path: 'isLive' },
  { name: 'prodURL', path: 'prodURL' },
  { name: 'performance', path: 'lastAudit.scores.performance' },
  { name: 'seo', path: 'lastAudit.scores.seo' },
  { name: 'accessibility', path: 'lastAudit.scores.accessibility' },
  { name: 'best-practices', path: 'lastAudit.scores.bestPractices' },
  { name: 'auditError', path: 'lastAudit.errorMessage', condition: (site) => site.lastAudit && site.lastAudit.isError },
];

/**
 * Transforms sites data for exporting.
 *
 * @param {Object[]} sites - The sites data to transform.
 * @return {Object[]} - The transformed sites data.
 */
function transformSitesData(sites) {
  return sites.map(({ domain, gitHubURL, lastAudit, isLive, prodURL }) => {
    const auditInfo = lastAudit ? {
      auditedAt: lastAudit.auditedAt,
      isError: lastAudit.isError,
      isLive: lastAudit.isLive,
      errorMessage: lastAudit.errorMessage,
      scores: extractAuditScores(lastAudit),
    } : null;

    return {
      domain,
      gitHubURL,
      lastAudit: auditInfo,
      isLive,
      prodURL,
    };
  });
}

/**
 * Selects specific properties from an object for exporting.
 *
 * @param {Object} obj - The object to select properties from.
 * @param {Object[]} properties - The properties to select.
 * @return {Object} - The object with only the selected properties.
 */
function selectPropertiesForObject(obj, properties) {
  return properties.reduce((result, property) => {
    if (property.condition && !property.condition(obj)) {
      return result;
    }

    const value = property.path.split('.').reduce((current, key) => current && current[key], obj);
    if (value !== undefined) {
      result[property.name] = value;
    }

    return result;
  }, {});
}

/**
 * Generates an Excel file with the provided data.
 *
 * @param {Object[]} data - The data to include in the Excel file.
 * @param {string} sheetName - The name of the sheet to include in the Excel file.
 * @return {Buffer} - The Excel file as a buffer.
 */
function generateExcel(data, sheetName) {
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

  return xlsx.write(workbook, { type: 'buffer' });
}

/**
 * Generates a CSV file with the provided data.
 *
 * @param {Object[]} data - The data to include in the CSV file.
 * @return {Buffer} - The CSV file as a buffer.
 */
function generateCsv(data) {
  const json2csvParser = new Parser();
  return Buffer.from(json2csvParser.parse(data));
}

/**
 * Exports sites data using a provided export function.
 *
 * @param {Function} exportFunction - The function to use for exporting.
 * @return {Promise<Buffer>} - The exported data as a buffer.
 */
const exportSites = async (exportFunction) => {
  const sites = await getCachedSitesWithAudits();
  const data = transformSitesData(sites);
  const dataForExport = data.map((site) => selectPropertiesForObject(site, SITES_EXPORT_PROPERTIES));
  return exportFunction(dataForExport);
}

/**
 * Exports sites data to an Excel file.
 *
 * @return {Promise<Buffer>} - The Excel file as a buffer.
 */
const exportSitesToExcel = async () => {
  return exportSites((data) => generateExcel(data, 'franklin-sites-status'));
}

/**
 * Exports sites data to a CSV file.
 *
 * @return {Promise<Buffer>} - The CSV file as a buffer.
 */
const exportSitesToCSV = async () => {
  return exportSites(generateCsv);
}

module.exports = {
  exportSitesToCSV,
  exportSitesToExcel,
  transformSitesData
};
