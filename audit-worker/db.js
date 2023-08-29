const { MongoClient, ObjectId } = require('mongodb');
const { log } = require('./util.js');

const COLLECTION_SITES = 'sites';
const COLLECTION_AUDITS = 'audits';

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

function DB(config) {
  const { mongodbUri, dbName } = config;

  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  let db = null;

  /**
   * Connect to the MongoDB database.
   */
  async function connect() {
    try {
      await client.connect();
      db = client.db(dbName);
      log('info', 'Database connection established.');

      await createIndexes(db);

      return { client, db };
    } catch (error) {
      log('error', 'Error connecting to database: ', error);
      throw error;
    }
  }

  async function close() {
    try {
      await client.close();
      console.log('Connection to MongoDB closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
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
   * @param {object} site - site audited.
   * @param {object} audit - The Lighthouse audit result.
   * @param {object} markdownContext - The markdown content and diff of content changes since last audit.
   * @param {string} githubDiff - Diff of code changes since last audit in patch format.
   */
  async function saveAudit(site, audit, markdownContext, githubDiff) {
    const { diff: markdownDiff, content: markdownContent } = markdownContext;
    const now = new Date();
    const newAudit = {
      siteId: new ObjectId(site._id),
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
   * @param {object} site - site audited.
   * @param {Error} error - The error that occurred during the audit.
   */
  async function saveAuditError(site, error) {
    const now = new Date();
    const newAudit = {
      siteId: new ObjectId(site._id),
      auditedAt: now,
      isError: true,
      errorMessage: error.message,
      auditResult: null,
    };
    await saveAuditRecord(site.domain, newAudit);
  }

  /**
   * Save an audit record to the MongoDB database.
   * @param {object} newAudit - The new audit record to save.
   */
  async function saveAuditRecord(newAudit) {
    try {
      await db.collection(COLLECTION_AUDITS).insertOne(newAudit);
      log('info', `Audit for domain ${newAudit.domain} saved successfully at ${now}`);
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

  return {
    connect,
    close,
    saveAudit,
    saveAuditError,
    getLatestAuditBySiteId,
  };
}

module.exports = DB;
