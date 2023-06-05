const {
  connectToDb,
  disconnectFromDb,
  createIndexes,
  getNextSiteToAudit,
  saveAudit,
  saveAuditError,
  setWorkerRunningState
} = require('./db');
const {
  auditSite,
  sleep
} = require('./util');

const WORKER_NAME = 'auditWorker';
let isRunning = true;

async function auditWorker() {
  try {
    await connectToDb();
    await setWorkerRunningState(WORKER_NAME, true);
    await createIndexes();

    console.info('Audit worker started');

    while (isRunning) {
      const site = await getNextSiteToAudit();

      if (!site) {
        console.info('No sites to audit, sleeping for 1 minute');
        await sleep(1000 * 60);
        continue;
      }

      const lastAudited = site.lastAudited ? new Date(site.lastAudited) : null;
      const now = new Date();
      const oneDayInMilliseconds = 1000 * 60 * 60 * 24;
      const timeSinceLastAudit = lastAudited ? now - lastAudited : oneDayInMilliseconds;

      if (timeSinceLastAudit < oneDayInMilliseconds) {
        const timeToWait = oneDayInMilliseconds - timeSinceLastAudit;
        console.info(`Last site audit was less than 24 hours ago. Waiting for ${timeToWait / (1000 * 60)} minutes.`);
        await sleep(timeToWait);
      }

      try {
        const audit = await auditSite(site.domain);
        await saveAudit(site.domain, audit);
        console.info(`Audited ${site.domain}`);
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message || err;
        console.error(`Error during site audit for domain ${site.domain}:`, errMsg);
        await saveAuditError(site.domain, errMsg);
      }
    }
  } catch (error) {
    console.error(error);
    isRunning = false;
  } finally {
    try {
      await setWorkerRunningState(WORKER_NAME, false);
      await disconnectFromDb();
    } catch (err) {
      console.error('Error updating worker running state:', err);
    }
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Flushing data before exit...');
  isRunning = false;
  await setWorkerRunningState(WORKER_NAME, false);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Flushing data before exit...');
  isRunning = false;
  await setWorkerRunningState(WORKER_NAME, false);
  process.exit(0);
});

auditWorker();
