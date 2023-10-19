/**
 * MongoDB related functions and configurations.
 * @module MongoDB
 */

const { MongoClient } = require('mongodb');

/**
 * URI for MongoDB connection.
 * @constant
 * @type {string}
 */
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Name of the database.
 * @constant
 * @type {string}
 */
const DATABASE_NAME = 'franklin-status';

/**
 * Name of the sites collection.
 * @constant
 * @type {string}
 */
const COLLECTION_SITES = 'sites';

/**
 * MongoDB client instance.
 * @type {MongoClient|null}
 */
let client;

/**
 * Database instance.
 * @type {Db|null}
 */
let db;

/**
 * Connects to the MongoDB database.
 * @async
 * @function
 * @throws {Error} Throws an error if unable to connect.
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
 * Disconnects from the MongoDB database.
 * @async
 * @function
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

/**
 * Retrieves the database instance.
 * @function
 * @throws {Error} Throws an error if not connected to the database.
 * @returns {Db} The database instance.
 */
function getDb() {
  if (!db) {
    throw new Error('Not connected to database');
  }
  return db;
}

/**
 * Creates a site in the "sites" collection.
 *
 * @async
 * @function
 * @param {Object} site - The site data.
 * @returns {Promise<InsertOneWriteOpResult<any>>} A promise that resolves when the operation is complete.
 */
function createSite(site) {
  const db = getDb();
  return db.collection(COLLECTION_SITES).insertOne(site);
}

/**
 * Updates a site in the "sites" collection by its ID.
 *
 * @async
 * @function
 * @param {ObjectID} siteId - The site ID.
 * @param {Object} updatedSite - The updated site data.
 * @returns {Promise<UpdateWriteOpResult>} A promise that resolves when the operation is complete.
 */
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

/**
 * Updates a site in the "sites" collection by its domain.
 *
 * @async
 * @function
 * @param {string} domain - The site domain.
 * @param {Object} updatedSite - The updated site data.
 * @returns {Promise<UpdateWriteOpResult>} A promise that resolves when the operation is complete.
 */
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
 * Retrieves site metadata by its domain.
 *
 * @async
 * @function
 * @param {string} domain - The site domain.
 * @returns {Promise<Object|null>} A promise that resolves with the site metadata or null if not found.
 */
async function getSiteMetadataByDomain(domain) {
  const db = getDb();

  return db.collection(COLLECTION_SITES).findOne({ domain });
}

/**
 * Retrieves a site and its audits by its domain.
 *
 * @async
 * @function
 * @param {string} domain - The site domain.
 * @returns {Promise<Object|null>} A promise that resolves with the site data or null if not found.
 */
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
    { $unwind: { path: '$audits', preserveNullAndEmptyArrays: true } },
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

/**
 * Retrieves a site's ID by its domain.
 *
 * @async
 * @function
 * @param {string} domain - The site domain.
 * @returns {Promise<ObjectID|null>} A promise that resolves with the site ID or null if not found.
 */
async function getSiteIdByDomain(domain) {
  const db = getDb();

  const projection = {
    _id: 1,
  };

  const site = await db.collection(COLLECTION_SITES).findOne({ domain }, { projection });
  return site?._id;
}

/**
 * Retrieves a list of sites to audit.
 *
 * @async
 * @function
 * @returns {Promise<Array<Object>>} A promise that resolves with the list of sites.
 */
async function getSitesToAudit() {
  const db = getDb();

  const projection = {
    _id: 1,
  };

  return db.collection(COLLECTION_SITES).find({}, { projection }).toArray();
}

/**
 * Retrieves all sites along with their latest audits.
 *
 * @async
 * @function
 * @returns {Promise<Array<Object>>} A promise that resolves with the list of sites.
 */
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
