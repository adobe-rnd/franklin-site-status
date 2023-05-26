const { MongoClient } = require('mongodb');

let db;

async function connectToDb() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('franklin-status');
}

function getDb() {
  if (!db) {
    throw new Error('Not connected to database');
  }
  return db;
}

async function getSiteStatus(domain) {
  const db = getDb();
  const collection = db.collection('sites');
  return await collection.findOne({ domain: domain });
}

async function getSitesWithAudits() {
  const db = getDb();
  const sites = await db.collection('sites').find().toArray();
  for (let site of sites) {
    site.audits = await db.collection('audits')
      .find({ domain: site.domain })
      .sort({ 'auditResult.performance': -1 })
      .toArray();
  }
  return sites;
}

async function getUrlsFromDb() {
  const db = getDb();
  const collection = db.collection('sites');
  return collection.find().toArray();
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


async function saveAudit(domain, audit) {
  const db = getDb();
  const auditCollection = db.collection('audits');

  await auditCollection.insertOne({
    domain: domain,
    auditResult: audit,
    auditedAt: new Date(),
  });
}

async function getWorkerRunningState(workerName) {
  const db = getDb();
  const workerState = await db.collection('workerStates').findOne({ name: workerName });
  return workerState?.isRunning || false;
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
  getDb,
  getSiteStatus,
  getSitesWithAudits,
  saveAudit,
  getNextSiteToAudit,
  getWorkerRunningState,
  setWorkerRunningState,
};
