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
  const sitesCollection = db.collection('sites');
  const auditsCollection = db.collection('audits');

  const pipeline = [
    { $match: { domain: domain } },
    {
      $lookup: {
        from: auditsCollection.collectionName,
        let: { siteDomain: "$domain" },
        pipeline: [
          { $match: { $expr: { $eq: ["$domain", "$$siteDomain"] } } },
          { $sort: { auditedAt: -1 } },
          { $limit: 1 }
        ],
        as: "latestAudit"
      }
    }
  ];

  const siteWithLatestAudit = await sitesCollection.aggregate(pipeline).toArray();
  return siteWithLatestAudit[0];
}

async function getSitesWithAudits() {
  const db = getDb();

  const pipeline = [
    {
      $lookup: {
        from: 'audits',
        let: { site_domain: "$domain" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$domain", "$$site_domain"]
              }
            }
          },
          { $sort: { auditedAt: -1 } },
          { $limit: 1 }
        ],
        as: 'latestAudit'
      }
    },
    {
      $unwind: '$latestAudit'
    },
    {
      $project: {
        domain: 1,
        gitHubURL: 1,
        isError: '$latestAudit.isError',
        errorMessage: '$latestAudit.errorMessage',
        scores: {
          performance: { $ifNull: ["$latestAudit.auditResult.categories.performance.score", null] },
          accessibility: { $ifNull: ["$latestAudit.auditResult.categories.accessibility.score", null] },
          bestPractices: { $ifNull: ["$latestAudit.auditResult.categories.best-practices.score", null] },
          seo: { $ifNull: ["$latestAudit.auditResult.categories.seo.score", null] },
        }
      }
    },
    {
      $sort: { 'isError': 1, 'scores.performance': 1 }
    }
  ];

  return await db.collection('sites').aggregate(pipeline).toArray();
}


async function getWorkerRunningState(workerName) {
  const db = getDb();
  const workerState = await db.collection('workerStates').findOne({ name: workerName });
  return workerState?.isRunning || false;
}

module.exports = {
  connectToDb,
  getSiteStatus,
  getSitesWithAudits,
  getWorkerRunningState,
};
