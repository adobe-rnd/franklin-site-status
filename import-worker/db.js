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

async function setWorkerRunningState(workerName, isRunning) {
  const db = getDb();
  const workersCollection = db.collection('workerStates');

  await workersCollection.updateOne(
    { name: workerName },
    { $set: { isRunning: isRunning, lastUpdated: new Date() } },
    { upsert: true }
  );
}

async function cleanupOldAudits() {
  const TTL_DAYS = 30; // Replace with your desired TTL in days
  const db = getDb();
  const ttlDate = new Date(Date.now() - (TTL_DAYS * 24 * 60 * 60 * 1000));

  const cursor = db.collection('sites').find();

  while(await cursor.hasNext()) {
    const site = await cursor.next();

    // Remove audits older than TTL
    site.audits = site.audits.filter(audit => audit.auditedAt > ttlDate);

    await db.collection('sites').updateOne(
      { _id: site._id },
      { $set: { audits: site.audits } }
    );
  }
}

module.exports = {
  cleanupOldAudits,
  connectToDb,
  getDb,
  setWorkerRunningState,
};
