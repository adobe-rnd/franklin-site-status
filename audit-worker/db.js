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

/**
 * Get the MongoDB database instance.
 * @throws {Error} If not connected to database.
 * @returns {MongoDB.Db} The MongoDB database instance.
 */
function getDb() {
  if (!db) {
    throw new Error('Not connected to database');
  }
  return db;
}

/**
 * Process the Lighthouse audit result. Currently, makes sure only certain properties are saved.
 * This should allow around 600 audits per domain to be saved (24kb in 16MB max mongo document size).
 * @param {object} result - The Lighthouse audit result.
 * @returns {object} The processed Lighthouse audit result.
 */
function processLighthouseResult({
                                   categories,
                                   requestedUrl,
                                   finalUrl,
                                   mainDocumentUrl,
                                   finalDisplayedUrl,
                                   lighthouseVersion,
                                   userAgent,
                                   environment,
                                   runWarnings,
                                   configSettings,
                                   timing,
                                 } = {}) {
  return {
    categories,
    requestedUrl,
    finalUrl,
    mainDocumentUrl,
    finalDisplayedUrl,
    lighthouseVersion,
    userAgent,
    environment,
    runWarnings,
    configSettings,
    timing,
  };
}

/**
 * Create indexes in the MongoDB database for efficient querying.
 */
async function createIndexes() {
  try {
    await db.collection(COLLECTION_SITES).createIndex({ domain: 1 });
    await db.collection(COLLECTION_SITES).createIndex({ 'audits.auditedAt': -1 });
    await db.collection(COLLECTION_SITES).createIndex({ 'audits.auditedAt': 1 });
    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes: ', error);
  }
}

/**
 * Get the next site to be audited. The site selected will be the one
 * that has not been audited yet or the one that was last audited.
 * If all sites have been audited within the last 24 hours, it will return
 * the site that was audited the longest time ago.
 * @returns {Object} The site to be audited.
 */
async function getNextSiteToAudit() {
  const db = getDb();
  const site = await db.collection(COLLECTION_SITES)
    .find()
    .sort({ lastAudited: 1 })
    .limit(1)
    .toArray();

  return site.length > 0 ? site[0] : null;
}

/**
 * Save a regular Lighthouse audit result to the MongoDB database.
 * @param {string} domain - The domain of the site.
 * @param {object} audit - The Lighthouse audit result.
 */
async function saveAudit(domain, audit) {
  const now = new Date();
  const newAudit = {
    auditedAt: now,
    isError: false,
    auditResult: processLighthouseResult(audit.lighthouseResult),
  };
  await saveAuditRecord(domain, newAudit);
}

/**
 * Save an error that occurred during a Lighthouse audit to the MongoDB database.
 * @param {string} domain - The domain of the site.
 * @param {Error} error - The error that occurred during the audit.
 */
async function saveAuditError(domain, error) {
  const now = new Date();
  const newAudit = {
    auditedAt: now,
    isError: true,
    errorMessage: error.message,
    auditResult: null,
  };
  await saveAuditRecord(domain, newAudit);
}

/**
 * Save an audit record to the MongoDB database.
 * @param {string} domain - The domain of the site.
 * @param {object} newAudit - The new audit record to save.
 */
async function saveAuditRecord(domain, newAudit) {
  const db = getDb();
  try {
    await db.collection(COLLECTION_SITES).updateOne(
      { domain: domain },
      {
        $push: { audits: newAudit },
        $set: { lastAudited: new Date() }
      }
    );
    console.log('Audit saved successfully');
  } catch (error) {
    console.error('Error saving audit: ', error);
  }
}

/**
 * Set the state of the audit worker in the MongoDB database.
 * @param {string} workerName - The name of the audit worker.
 * @param {boolean} isRunning - The running state of the audit worker.
 */
async function setWorkerRunningState(workerName, isRunning) {
  const db = getDb();
  try {
    await db.collection(COLLECTION_WORKERSTATES).updateOne(
      { name: workerName },
      { $set: { isRunning: isRunning, lastUpdated: new Date() } },
      { upsert: true }
    );
    console.log('Worker running state updated successfully');
  } catch (error) {
    console.error('Error updating worker running state: ', error);
  }
}

module.exports = {
  connectToDb,
  disconnectFromDb,
  createIndexes,
  saveAudit,
  saveAuditError,
  getNextSiteToAudit,
  setWorkerRunningState,
};
