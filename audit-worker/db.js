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

async function createIndexes() {
  // Create an index on the 'domain' field in the 'sites' collection
  await db.collection('sites').createIndex({ domain: 1 });
  await db.collection('sites').createIndex({ 'audits.auditedAt': -1 });
  await db.collection('sites').createIndex({ 'audits.auditedAt': 1 });
}

async function getNextSiteToAudit() {
  const db = getDb();
  const site = await db.collection('sites')
    .find()
    .sort({ lastAudited: 1 })
    .limit(1)
    .toArray();

  if (site.length > 0) {
    return site[0];
  }
}

async function saveAudit(domain, audit, error) {
  const db = getDb();
  const now = new Date();
  const newAudit = {
    auditedAt: now,
    isError: !!error,
    errorMessage: error?.message,
    auditResult: audit,
  };
  await db.collection('sites').updateOne(
    { domain: domain },
    {
      $push: { audits: newAudit },
      $set: { lastAudited: now }
    }
  );
}

async function setWorkerRunningState(workerName, isRunning) {
  const db = getDb();
  await db.collection('workerStates').updateOne(
    { name: workerName },
    { $set: { isRunning: isRunning, lastUpdated: new Date() } },
    { upsert: true }
  );
}

module.exports = {
  connectToDb,
  createIndexes,
  saveAudit,
  getNextSiteToAudit,
  setWorkerRunningState,
};
