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

  const pipeline = [
    { $match: { domain: domain } },
    {
      $lookup: {
        from: 'audits',
        let: { siteDomain: "$domain" },
        pipeline: [
          { $match: { $expr: { $eq: ["$domain", "$$siteDomain"] } } },
          { $sort: { auditedAt: -1 } }
        ],
        as: "auditHistory"
      }
    },
    {
      $unwind: { path: "$auditHistory", preserveNullAndEmptyArrays: true }
    },
    {
      $group: {
        _id: "$_id",
        domain: { $first: "$domain" },
        lastAudited: { $first: "$lastAudited" },
        githubUrl: { $first: "$gitHubURL" },
        auditHistory: {
          $push: {
            auditedAt: "$auditHistory.auditedAt",
            errorMessage: "$auditHistory.errorMessage",
            isError: "$auditHistory.isError",
            scores: {
              performance: "$auditHistory.auditResult.categories.performance.score",
              accessibility: "$auditHistory.auditResult.categories.accessibility.score",
              bestPractices: "$auditHistory.auditResult.categories.best-practices.score",
              seo: "$auditHistory.auditResult.categories.seo.score"
            }
          }
        },
      }
    }
  ];

  const result = await db.collection('sites').aggregate(pipeline).next();
  return result;
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
      $unwind: { path: '$latestAudit', preserveNullAndEmptyArrays: true }
    },
    {
      $project: {
        domain: 1,
        gitHubURL: 1,
        lastAudited: 1,
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
      $sort: {
        'isError': 1,
        'scores.performance': 1,
        'scores.accessibility': 1,
        'scores.bestPractices': 1,
        'scores.seo': 1,
      }
    }
  ];

  return await db.collection('sites').aggregate(pipeline).toArray();
}

module.exports = {
  connectToDb,
  getSiteStatus,
  getSitesWithAudits,
};
