const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'franklin-status';
const COLLECTION_SITES = 'sites';

const SITES_SORT_CONFIG = [
  { key: 'lastAudit.auditResult.categories.performance.score', desc: false },
  { key: 'lastAudit.auditResult.categories.seo.score', desc: false },
  { key: 'lastAudit.auditResult.categories.accessibility.score', desc: false },
  { key: 'lastAudit.auditResult.categories.bestPractices.score', desc: false },
];

let client;
let db;

/**
 * Connect to the MongoDB database.
 */
async function connectToDb() {
  try {
    client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.info('Database connection established.');
  } catch (error) {
    console.error('Error connecting to database: ', error);
    throw error;
  }
}

/**
 * Disconnect from the MongoDB database.
 */
async function disconnectFromDb() {
  try {
    if (!client) {
      console.warn('Warning: Not connected to database');
      return;
    }
    client.close();
    db = null;
    client = null;

    console.info('Database connection closed.');
  } catch (error) {
    console.error('Error disconnecting from database: ', error);
  }
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

/**
 * Saves a site to the "sites" collection.
 *
 * @param {Object} site - The site data.
 * @returns {Promise} A promise that resolves when the operation is complete.
 */
function saveSite(site) {
  const db = getDb();
  return db.collection('sites').insertOne(site);
}

/**
 * Retrieves a site by ID from the "sites" collection.
 *
 * @param {number|string} id - The ID of the site.
 * @returns {Promise} A promise that resolves with the site data.
 */
function getSiteById(id) {
  const db = getDb();
  return db.collection('sites').findOne({ id });
}

async function getSiteStatus(domain) {
  const db = getDb();

  const site = await db.collection(COLLECTION_SITES).findOne({ domain: domain });

  if (site && Array.isArray(site.audits)) {
    site.audits.sort((a, b) => new Date(b.auditedAt) - new Date(a.auditedAt));
  }

  return site;
}

async function getSitesWithAudits() {
  const db = getDb();

  let sites = await db.collection(COLLECTION_SITES).find().toArray();

  sites = sites.map(site => {
    site.lastAudit = site.audits && site.audits.length > 0 ? site.audits[0] : null;
    return site;
  });

  return sortSites(sites, SITES_SORT_CONFIG);
}

module.exports = {
  connectToDb,
  getSiteById,
  getSiteStatus,
  getSitesWithAudits,
  saveSite,
};
