const axios = require('axios');
const { connectToDb, getDb, setWorkerRunningState, getNextSiteToAudit, saveAudit } = require('./db');
const querystring = require('querystring');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const processAuditData = (data) => {
  for (let key in data) {
    if (typeof data[key] === 'object' && data[key] !== null) {
      processAuditData(data[key]);
    }

    if (key.includes('.')) {
      const newKey = key.replace('.', '_');
      data[newKey] = data[key];
      delete data[key];
    }
  }
}

let isRunning = true;

async function auditWorker() {
  await connectToDb();

  const db = getDb();

  // Create a TTL index on the auditedAt field, expiring documents after 30 days
  await db.collection('audits').createIndex({ "auditedAt": 1 }, { expireAfterSeconds: 2592000 });

  await setWorkerRunningState('auditWorker', true);

  console.info('Audit worker started');

  while (isRunning) {
    const site = await getNextSiteToAudit(db);

    if (!site) {
      // If no sites are available to audit, sleep for a while before trying again
      console.info('No sites to audit, sleeping for 1 minute');
      await sleep(1000 * 60);
      continue;
    }

    try {
      const siteUrl = `https://${site.domain}`;
      const apiURL = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${querystring.escape(siteUrl)}&key=${process.env.PAGESPEED_API_KEY}&category=performance&category=accessibility&category=best-practices&category=seo`;
      const { data: lhs } = await axios.get(apiURL);

      processAuditData(lhs);

      // Save audit result and Update site's lastAudited timestamp
      await saveAudit(site.domain, lhs.lighthouseResult, null);

    } catch (err) {
      let msg = err.message;
      if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      console.error(`Error during site audit for domain ${site.domain}:`, msg);

      await saveAudit(site.domain, null, msg);
    }

    // Update site's lastAudited timestamp
    await db.collection('sites').updateOne({ domain: site.domain }, { $set: { lastAudited: new Date() } });

    console.info(`Audited ${site.domain}`);

    // Sleep for a while to distribute audits evenly across the day
    await sleep(1000 * 60 * 24 / 100);
  }
}

auditWorker()
  .catch(error => {
    console.error(error);
    isRunning = false;
  })
  .finally(async () => {
    await setWorkerRunningState('auditWorker', false);
  });
