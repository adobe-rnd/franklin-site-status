const xlsx = require('xlsx');
const { Parser } = require('json2csv');

const getCachedSitesWithAudits = require('../cache.js');
const { extractAuditScores } = require('./auditUtils.js');


const SITES_EXPORT_PROPERTIES = [
  { name: 'domain', path: 'domain' },
  { name: 'gitHubURL', path: 'gitHubURL' },
  { name: 'performance', path: 'lastAudit.scores.performance' },
  { name: 'seo', path: 'lastAudit.scores.seo' },
  { name: 'accessibility', path: 'lastAudit.scores.accessibility' },
  { name: 'best-practices', path: 'lastAudit.scores.bestPractices' },
  { name: 'auditError', path: 'lastAudit.errorMessage', condition: (site) => site.lastAudit && site.lastAudit.isError },
];

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

function generateExcel(data, sheetName) {
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

  return xlsx.write(workbook, { type: 'buffer' });
}

function generateCsv(data) {
  const json2csvParser = new Parser();
  return Buffer.from(json2csvParser.parse(data));
}

const exportSites = async (exportFunction) => {
  const sites = await getCachedSitesWithAudits();
  const data = transformSitesData(sites);
  const dataForExport = data.map((site) => selectPropertiesForObject(site, SITES_EXPORT_PROPERTIES));
  return exportFunction(dataForExport);
}

const exportSitesToExcel = async () => {
  return exportSites((data) => generateExcel(data, 'franklin-sites-status'));
}

const exportSitesToCSV = async () => {
  return exportSites(generateCsv);
}

module.exports = {
  exportSitesToCSV,
  exportSitesToExcel,
  transformSitesData
};
