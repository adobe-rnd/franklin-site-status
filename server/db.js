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

async function getSiteStatus(domain) {
  const db = getDb();

  const site = await db.collection('sites').findOne({ domain: domain });
  return site;
}

async function getSitesWithAudits() {
  const db = getDb();

  const sites = await db.collection('sites').find().toArray();
  sites.forEach(site => {
    site.latestAudit = site.audits[0];
  });

  return sites;
}

module.exports = {
  connectToDb,
  getSiteStatus,
  getSitesWithAudits,
};
