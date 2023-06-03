const { getSitesWithAudits } = require('./db');

let cachedSites = null;
let cacheTimestamp = null;

async function getCachedSitesWithAudits() {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (!cachedSites || now - cacheTimestamp > fiveMinutes) {
    cachedSites = await getSitesWithAudits();
    cacheTimestamp = now;
  }

  return cachedSites;
}

module.exports = getCachedSitesWithAudits;
