const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'franklin-status';
const COLLECTION_SITES = 'sites';
const COLLECTION_WORKERSTATES = 'workerStates';

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

/**
 * Create indexes in the MongoDB database for efficient querying.
 */
async function createIndexes() {
  try {
    await db.collection(COLLECTION_SITES).createIndex({ domain: 1 }, { unique: true });
    await db.collection(COLLECTION_SITES).createIndex({ prodURL: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTION_SITES).createIndex({
      domain: 1,
      prodURL: 1
    });
    await db.collection(COLLECTION_SITES).createIndex({ githubId: 1 }, { unique: true });
    await db.collection(COLLECTION_SITES).createIndex({ lastAudited: 1 });
    await db.collection(COLLECTION_SITES).createIndex({ 'audits.auditedAt': -1 });
    await db.collection(COLLECTION_SITES).createIndex({ 'audits.auditedAt': 1 });
    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes: ', error);
  }
}

async function setWorkerRunningState(workerName, isRunning) {
  const db = getDb();
  const workersCollection = db.collection(COLLECTION_WORKERSTATES);

  await workersCollection.updateOne(
    { name: workerName },
    { $set: { isRunning: isRunning, lastUpdated: new Date() } },
    { upsert: true }
  );
}

async function cleanupOldAudits() {
  const TTL_DAYS = 30;

  console.info(`Cleaning up audits older than ${TTL_DAYS} days...`);

  const db = getDb();
  const ttlDate = new Date(Date.now() - (TTL_DAYS * 24 * 60 * 60 * 1000));

  const cursor = db.collection(COLLECTION_SITES).find();

  while (await cursor.hasNext()) {
    const site = await cursor.next();

    // Remove audits older than TTL
    site.audits = site.audits.filter(audit => audit.auditedAt > ttlDate);

    if (site.audits.length > 0) {
      console.info(`Cleaning up ${site.audits.length} audits for ${site.domain}...`);
    }

    await updateSiteAudits(site._id, site.audits);
  }
}

async function updateSiteAudits(siteId, audits) {
  const db = getDb();
  await db.collection(COLLECTION_SITES).updateOne(
    { _id: siteId },
    { $set: { audits: audits } }
  );
}

module.exports = {
  cleanupOldAudits,
  connectToDb,
  createIndexes,
  disconnectFromDb,
  getDb,
  setWorkerRunningState,
};
