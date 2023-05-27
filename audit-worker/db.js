const { MongoClient } = require('mongodb');

let db;

async function connectToDb() {
  const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  db = client.db('franklin-status');
}

function getDb() {
  if (!db) {
    throw new Error('Not connected to database');
  }
  return db;
}

async function ensureAuditTTL(auditTTL) {
  // Create a TTL index on the auditedAt field, expiring documents after the specified number of days
  await db.collection('audits').createIndex({ "auditedAt": 1 }, { expireAfterSeconds: auditTTL });
}

/**
 * Get the next site that should be audited.
 * The site that was last audited is selected, if no site was audited before, the first site is returned.
 */
async function getNextSiteToAudit() {
  const db = getDb();
  const sitesCollection = db.collection('sites');

  // Use the $exists operator to sort by the existence of lastAudited, putting sites that were never audited first
  // Then, sort by lastAudited to get the least recently audited sites next
  const site = await sitesCollection
    .find()
    .sort({ lastAudited: { $exists: -1 }, lastAudited: 1 })
    .limit(1)
    .toArray();

  if (site.length > 0) {
    return site[0];
  }
}


async function saveAudit(domain, audit, error) {
  const db = getDb();
  const auditCollection = db.collection('audits');

  await auditCollection.insertOne({
    domain: domain,
    isError: !!error,
    errorMessage: error?.message,
    auditResult: audit,
    auditedAt: new Date(),
  });
}

async function setLastAudited(domain) {
  const db = getDb();
  const sitesCollection = db.collection('sites');

  await sitesCollection.updateOne(
    { domain: domain },
    { $set: { lastAudited: new Date() } }
  );
}

async function setWorkerRunningState(workerName, isRunning) {
  const db = getDb();
  const workersCollection = db.collection('workerStates');

  await workersCollection.updateOne(
    { name: workerName },
    { $set: { isRunning: isRunning, lastUpdated: new Date() } },
    { upsert: true }
  );
}


module.exports = {
  connectToDb,
  ensureAuditTTL,
  getDb,
  saveAudit,
  getNextSiteToAudit,
  setLastAudited,
  setWorkerRunningState,
};
