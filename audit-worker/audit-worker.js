const {
  connectToDb,
  ensureAuditTTL,
  getNextSiteToAudit,
  saveAudit,
  setLastAudited,
  setWorkerRunningState
} = require('./db');
const {
  auditSite,
  getAuditTTL,
  sleep
} = require('./util');

const WORKER_NAME = 'auditWorker';

let isRunning = true;

async function auditWorker() {
  try {
    await connectToDb();
    await setWorkerRunningState(WORKER_NAME, true);
    await ensureAuditTTL(getAuditTTL());

    console.info('Audit worker started');

    while (isRunning) {
      const site = await getNextSiteToAudit();

      if (!site) {
        // If no sites are available to audit, sleep for a while before trying again
        console.info('No sites to audit, sleeping for 1 minute');
        await sleep(1000 * 60);
        continue;
      }

      try {
        const audit = await auditSite(site.domain);
        await saveAudit(site.domain, audit.lighthouseResult, null);

      } catch (err) {
        let msg = err.message;
        if (err.response?.data?.error) {
          msg = err.response.data.error;
        }
        console.error(`Error during site audit for domain ${site.domain}:`, msg);

        await saveAudit(site.domain, null, msg);
      }

      // Update site's lastAudited timestamp
      await setLastAudited(site.domain);

      console.info(`Audited ${site.domain}`);

      // Sleep for a while to distribute audits evenly across the day
      await sleep(1000 * 60 * 24 / 100);
    }
  } catch (error) {
    console.error(error);
    isRunning = false;
  } finally {
    try {
      await setWorkerRunningState(WORKER_NAME, false);
    } catch (err) {
      console.error('Error updating worker running state:', err);
    }
  }
}

auditWorker();
