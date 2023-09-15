/**
 * Provides caching functionalities for sites and their audits.
 * @module Cache
 */
const { getSitesWithAudits } = require('./db');

/**
 * Configuration for sorting sites based on PSI strategies.
 * @type {Object.<string, Array.<Object>>}
 */
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

/**
 * Cache for sites.
 * @type {Array.<Object>|null}
 */
let cachedSites = null;

/**
 * Cache for sorted sites based on PSI strategy.
 * @type {Object.<string, Array.<Object>|null>}
 */
let sortedSites = {
  mobile: null,
  desktop: null,
};

/**
 * Timestamp for the last cache update.
 * @type {number|null}
 */
let cacheTimestamp = null;

/**
 * Retrieves a nested value from an object based on a key string.
 *
 * @param {Object} obj - The object to extract the value from.
 * @param {string} keyString - The dot-separated key string.
 * @returns {any} The nested value, or -Infinity if any of the keys is not present.
 */
function getNestedValue(obj, keyString) {
  const keys = keyString.split('.');
  let value = obj;

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      return -Infinity;
    }

    value = value[key];
  }

  return value;
}

/**
 * Sorts sites based on a given sort configuration.
 *
 * @param {Array.<Object>} sites - The sites to sort.
 * @param {Array.<Object>} sortConfig - The sort configuration.
 * @returns {Array.<Object>} The sorted sites.
 */
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

/**
 * Retrieves sites with audits, either from the cache or freshly from the database.
 * Cached data is automatically refreshed every 5 minutes.
 *
 * @param {string} [psiStrategy='mobile'] - The PageSpeed Insights strategy ('mobile' or 'desktop').
 * @function
 * @async
 * @returns {Promise<Array.<Object>>} A promise resolving with the list of sites.
 */

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

/**
 * Invalidates the current cache, clearing all cached data.
 */
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
