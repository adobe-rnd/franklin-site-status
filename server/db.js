const { MongoClient } = require('mongodb');

const SITES_SORT_CONFIG = [
  { key: 'lastAudit.auditResult.categories.performance.score', desc: false },
  { key: 'lastAudit.auditResult.categories.seo.score', desc: false },
  { key: 'lastAudit.auditResult.categories.accessibility.score', desc: false },
  { key: 'lastAudit.auditResult.categories.bestPractices.score', desc: false },
];

let client;
let db;

async function connectToDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db('franklin-status');
  }
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Not connected to database');
  }
  return db;
}

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

async function getSiteStatus(domain) {
  const db = getDb();

  const site = await db.collection('sites').findOne({ domain: domain });

  if (site && Array.isArray(site.audits)) {
    site.audits.sort((a, b) => new Date(b.auditedAt) - new Date(a.auditedAt));
  }

  return site;
}

async function getSitesWithAudits() {
  const db = getDb();

  let sites = await db.collection('sites').find().toArray();

  sites = sites.map(site => {
    site.lastAudit = site.audits && site.audits.length > 0 ? site.audits[0] : null;
    return site;
  });

  return sortSites(sites, SITES_SORT_CONFIG);
}

module.exports = {
  connectToDb,
  getSiteStatus,
  getSitesWithAudits,
};
