const { getSitesWithAudits } = require('./db');

const SITES_SORT_CONFIG = {
  mobile: [
    { key: 'lastAudit.auditResults.mobile.categories.performance.score', desc: false },
    { key: 'lastAudit.auditResults.mobile.categories.seo.score', desc: false },
    { key: 'lastAudit.auditResults.mobile.categories.accessibility.score', desc: false },
    { key: 'lastAudit.auditResults.mobile.categories.bestPractices.score', desc: false },
  ],
  desktop: [
    { key: 'lastAudit.auditResults.desktop.categories.performance.score', desc: false },
    { key: 'lastAudit.auditResults.desktop.categories.seo.score', desc: false },
    { key: 'lastAudit.auditResults.desktop.categories.accessibility.score', desc: false },
    { key: 'lastAudit.auditResults.desktop.categories.bestPractices.score', desc: false },
  ]
};

let cachedSites = null;
let sortedSites = {
  mobile: null,
  desktop: null,
};
let cacheTimestamp = null;

function sortSites(sites, sortConfig) {
  return sites.sort((a, b) => {
    if (!a.lastAudit || a.lastAudit.isError) return 1;
    if (!b.lastAudit || b.lastAudit.isError) return -1;

    for (let config of sortConfig) {
      const { key, desc } = config;

      const valueA = getNestedValue(a, key) || -Infinity;
      const valueB = getNestedValue(b, key) || -Infinity;

      if (valueA !== valueB) {
        return desc ? valueB - valueA : valueA - valueB;
      }
    }

    // equal, so no change in order
    return 0;
  });
}

async function getCachedSitesWithAudits(psiStrategy = 'mobile') {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (!cachedSites || now - cacheTimestamp > fiveMinutes) {
    cachedSites = await getSitesWithAudits();
    cacheTimestamp = now;
    // Sort and cache for both strategies upon fresh data retrieval
    sortedSites.mobile = sortSites(cachedSites, SITES_SORT_CONFIG.mobile);
    sortedSites.desktop = sortSites(cachedSites, SITES_SORT_CONFIG.desktop);
  }

  // Return the cached sorted sites based on the psiStrategy
  return sortedSites[psiStrategy] || sortedSites.mobile;
}

function invalidateCache() {
  cachedSites = null;
  sortedSites.mobile = null;
  sortedSites.desktop = null;
  cacheTimestamp = null;
}


module.exports = {
  getCachedSitesWithAudits,
  invalidateCache,
};
