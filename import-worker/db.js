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
  setWorkerRunningState,
};
