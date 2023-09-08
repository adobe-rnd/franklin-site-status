/**
 * MongoDB related functions and configurations.
 * @module MongoDB
 */

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
    client = null;
    db = null;
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
 * Creates a site in the "sites" collection.
 *
 * @param {Object} site - The site data.
 * @returns {Promise} A promise that resolves when the operation is complete.
 */
function createSite(site) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).insertOne(site);
}

function updateSite(siteId, updatedSite) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).updateOne(
    { _id: siteId },
    {
      $set: updatedSite,
      $currentDate: {
        updatedAt: true
      },
    },
    { upsert: false }
  );
}

function updateSiteByDomain(domain, updatedSite) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).updateOne(
    { domain },
    {
      $set: updatedSite,
      $currentDate: {
        updatedAt: true
      },
    },
    { upsert: false }
  );
}

/**
 * Retrieves a site from the "sites" collection by its GitHub repo ID.
 *
 * @param {number|string} repoId - The GitHub repo ID associated with the site.
 * @returns {Promise} A promise that resolves with the site data.
 */
function getSiteByGitHubRepoId(repoId) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).findOne({ githubId: repoId });
}

async function getSiteMetadataByDomain(domain) {
  const db = getDb();

  return db.collection(COLLECTION_SITES).findOne({domain});
}

async function getSiteByDomain(domain) {
  const db = getDb();

  const query = [
    { $match: { domain: domain } },
    {
      $lookup: {
        from: 'audits',
        localField: '_id',
        foreignField: 'siteId',
        as: 'audits',
      },
    },
    { $unwind: { path: '$audits' } },
    { $sort: { 'audits.auditedAt': -1 } },
    {
      $group: {
        _id: '$_id',
        siteData: { $first: '$$ROOT' },
        audits: { $push: '$audits' },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ['$siteData', { audits: '$audits' }],
        },
      },
    },
    { $unset: ["_id", "audits._id", "audits.siteId"] },
  ];

  const result = await db.collection(COLLECTION_SITES).aggregate(query).toArray();
  return result.length > 0 ? result[0] : null;
}

async function getSitesToAudit() {
  const db = getDb();

  const projection = {
    _id: 1,
  };

  return db.collection(COLLECTION_SITES).find({}, { projection }).toArray();
}

async function getSitesWithAudits() {
  const db = getDb();

  const query = [
    {
      $lookup: {
        from: "audits",
        localField: "_id",
        foreignField: "siteId",
        as: "audits",
      },
    },
    { $unwind: { path: '$audits', preserveNullAndEmptyArrays: true } },
    { $sort: { "audits.auditedAt": -1 } },
    {
      $group: {
        _id: "$_id",
        siteData: { $first: "$$ROOT" },
        lastAudit: { $first: "$audits" },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [ "$siteData", { lastAudit: "$lastAudit" } ],
        },
      },
    },
    { $unset: ["audits", "_id", "lastAudit._id", "lastAudit.siteId"] },
  ];

  const sites = await db.collection(COLLECTION_SITES).aggregate(query, { allowDiskUse : true }).toArray();

  return sortSites(sites, SITES_SORT_CONFIG);
}

async function removeSiteByRepoId(repoId) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).deleteOne({ githubId: repoId });
}

module.exports = {
  COLLECTION_SITES,
  SITES_SORT_CONFIG,
  getDb,
  getNestedValue,
  connectToDb,
  disconnectFromDb,
  getSiteByGitHubRepoId,
  getSiteByDomain,
  getSiteMetadataByDomain,
  getSitesToAudit,
  getSitesWithAudits,
  createSite,
  sortSites,
  updateSite,
  updateSiteByDomain,
  removeSiteByRepoId,
};
