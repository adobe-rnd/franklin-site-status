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

  let client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  let db = null;

  /**
   * Set the MongoDB client. Used for testing.
   * @param newClient - The new MongoDB client.
   */
  function setMongoClient(newClient) {
    client = newClient;
  }

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
      let sitesCollection = db.collection(COLLECTION_SITES);
      let auditsCollection = db.collection(COLLECTION_AUDITS);

      // for 'sites' collection
      await sitesCollection.createIndex({ domain: 1 }, { unique: true });
      await sitesCollection.createIndex({ prodURL: 1 }, { unique: true, sparse: true });
      await sitesCollection.createIndex({ domain: 1, prodURL: 1 });

      // for 'audits' collection
      await auditsCollection.createIndex({ auditedAt: 1 });
      await auditsCollection.createIndex({ siteId: 1 });
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
    const { markdownDiff, markdownContent } = markdownContext;
    const now = new Date();
    const newAudit = {
      siteId: new ObjectId(site._id),
      domain: site.domain,
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
      domain: site.domain,
      auditedAt: now,
      isError: true,
      errorMessage: error.message,
      auditResult: null,
    };
    await saveAuditRecord(newAudit);
  }

  /**
   * Save an audit record to the MongoDB database.
   * @param {object} newAudit - The new audit record to save.
   */
  async function saveAuditRecord(newAudit) {
    const now = new Date();
    try {
      await db.collection(COLLECTION_AUDITS).insertOne(newAudit);
      log('info', `Audit for domain ${newAudit.domain} saved successfully at ${now}`);
    } catch (error) {
      log('error', 'Error saving audit: ', error);
    }
  }

  async function findSiteById(siteId) {
    try {
      const query = [
        { $match: { _id: ObjectId(siteId) } },
        {
          $lookup: {
            from: 'audits',
            localField: '_id',
            foreignField: 'siteId',
            as: 'audits',
          },
        },
        { $unwind: '$audits' },
        { $sort: { 'audits.auditedAt': -1 } },
        {
          $group: {
            _id: '$_id',
            domain: { $first: '$domain' },
            gitHubURL: { $first: '$gitHubURL' },
            isLive: { $first: '$isLive' },
            latestAudit: { $first: '$audits' },
          },
        },
      ];

      const result = await db.collection('sites').aggregate(query).toArray();

      return result[0]; // error intended in case result is empty
    } catch (error) {
      console.error('Error getting site by site id:', error.message);
    }
  }

  return {
    connect,
    close,
    findSiteById,
    saveAudit,
    saveAuditError,
    setMongoClient,
  };
}

module.exports = DB;
