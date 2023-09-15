/**
 * MongoDB related functions and configurations.
 * @module MongoDB
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'franklin-status';
const COLLECTION_SITES = 'sites';

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

async function getSiteMetadataByDomain(domain) {
  const db = getDb();

  return db.collection(COLLECTION_SITES).findOne({ domain });
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

async function getSiteIdByDomain(domain) {
  const db = getDb();

  const projection = {
    _id: 1,
  };

  const site = await db.collection(COLLECTION_SITES).findOne({ domain }, { projection });
  return site?._id;
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
          $mergeObjects: ["$siteData", { lastAudit: "$lastAudit" }],
        },
      },
    },
    { $unset: ["audits", "_id", "lastAudit._id", "lastAudit.siteId"] },
  ];

  return db.collection(COLLECTION_SITES).aggregate(query, { allowDiskUse: true }).toArray();
}

module.exports = {
  COLLECTION_SITES,
  getDb,
  getNestedValue,
  connectToDb,
  disconnectFromDb,
  getSiteByDomain,
  getSiteIdByDomain,
  getSiteMetadataByDomain,
  getSitesToAudit,
  getSitesWithAudits,
  createSite,
  updateSite,
  updateSiteByDomain,
};
