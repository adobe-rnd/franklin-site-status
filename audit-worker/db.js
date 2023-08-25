const { MongoClient } = require('mongodb');
const { log } = require('./util.js');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('Please set the MONGODB_URI environment variable');

const DATABASE_NAME = 'franklin-status';
const COLLECTION_SITES = 'sites';
const COLLECTION_AUDITS = 'audits';

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
    log('info', 'Database connection established.');
  } catch (error) {
    log('error', 'Error connecting to database: ', error);
    throw error;
  }
}

/**
 * Disconnect from the MongoDB database.
 */
async function disconnectFromDb() {
  try {
    if (!client) {
      log('warn', 'Warning: Not connected to database');
      return;
    }
    client.close();
    db = null;
    client = null;

    log('info', 'Database connection closed.');
  } catch (error) {
    log('error', 'Error disconnecting from database: ', error);
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
                                   audits = {},
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
    audits: {
      'third-party-summary': audits['third-party-summary'],
      'total-blocking-time': audits['total-blocking-time'],
    }
  };
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
    await db.collection(COLLECTION_AUDITS).createIndex({ auditedAt: -1 });
    await db.collection(COLLECTION_AUDITS).createIndex({ auditedAt: 1 });
    log('info', 'Indexes created successfully');
  } catch (error) {
    log('error', 'Error creating indexes: ', error);
  }
}

/**
 * Save a regular Lighthouse audit result to the MongoDB database.
 * @param {object} siteId - ID of the site audited.
 * @param {object} audit - The Lighthouse audit result.
 * @param {object} markdownContext - The markdown content and diff of content changes since last audit.
 * @param {string} githubDiff - Diff of code changes since last audit in patch format.
 */
async function saveAudit(siteId, audit, markdownContext, githubDiff) {
  const { diff: markdownDiff, content: markdownContent } = markdownContext;
  const now = new Date();
  const newAudit = {
    siteId,
    auditedAt: now,
    isError: false,
    isLive: site.isLive,
    markdownContent,
    markdownDiff,
    githubDiff,
    auditResult: processLighthouseResult(audit.lighthouseResult),
  };
  await saveAuditRecord(newAudit);
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
 * @param {object} newAudit - The new audit record to save.
 */
async function saveAuditRecord(newAudit) {
  const db = getDb();

  try {
    await db.collection(COLLECTION_AUDITS).insertOne(newAudit);
    log('info', `Audit for domain ${domain} saved successfully at ${now}`);
  } catch (error) {
    log('error', 'Error saving audit: ', error);
  }
}

async function getLatestAuditBySiteId(siteId) {
  try {
    const query = { siteId: siteId };
    const sort = { auditedAt: -1 };

    return db.collection('audits').findOne(query, { sort });
  } catch (error) {
    console.error('Error getting latest audit by site id:', error.message);
  }
}

module.exports = {
  connectToDb,
  disconnectFromDb,
  createIndexes,
  getLatestAuditBySiteId,
  saveAudit,
  saveAuditError,
};
