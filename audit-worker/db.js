const { MongoClient, ObjectId } = require('mongodb');
const { log } = require('./util.js');

const COLLECTION_SITES = 'sites';
const COLLECTION_AUDITS = 'audits';

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

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

  /**
   * Closes the connection to the MongoDB database.
   * @returns {Promise<void>} Resolves once connection is closed.
   */
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

      // for 'audits' collection
      await auditsCollection.createIndex({ auditedAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_IN_SECONDS });
      await auditsCollection.createIndex({ siteId: 1 });
      await auditsCollection.createIndex({ type: 1, subType: 1 });
      log('info', 'Indexes created successfully');
    } catch (error) {
      log('error', 'Error creating indexes: ', error);
    }
  }

  /**
   * Saves an audit to the MongoDB database.
   * @param {object} site - Site object containing details of the audited site.
   * @param {object} audit - Audit object containing the type and result of the audit.
   * @param {object} markdownContext - Markdown difference data.
   * @param {object} githubDiff - GitHub difference data.
   * @returns {Promise<void>} Resolves once audit is saved.
   */
  async function saveAudit(site, audit, markdownContext, githubDiff) {
    const { markdownDiff, markdownContent } = markdownContext;
    const now = new Date();
    const newAudit = {
      siteId: new ObjectId(site._id),
      auditedAt: now,
      type: audit.type,
      subType: audit.subType,
      isError: false,
      isLive: site.isLive,
      markdownContent,
      markdownDiff,
      githubDiff,
      auditResult: audit.result,
    };

    await saveAuditRecord(newAudit);

    log('info', `Audit for domain ${site.domain} saved successfully at ${now}`);
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
    await saveAuditRecord(newAudit);
  }

  /**
   * Save an audit record to the MongoDB database.
   * @param {object} newAudit - The new audit record to save.
   */
  async function saveAuditRecord(newAudit) {
    try {
      await db.collection(COLLECTION_AUDITS).insertOne(newAudit);
    } catch (error) {
      log('error', 'Error saving audit: ', error);
    }
  }

  /**
   * Fetches a site by its ID and gets its latest audit.
   * @param {string} siteId - The ID of the site to fetch.
   * @returns {Promise<object>} Site document with its latest audit.
   */
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
        { $unwind: { path: '$audits', preserveNullAndEmptyArrays: true } },
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
