const {
  connectToDb,
  disconnectFromDb,
  createIndexes,
  getNextSiteToAudit,
  saveAudit,
  saveAuditError,
  setWorkerRunningState,
} = require('./db');
const {
  performPSICheck,
  sleep
} = require('./util');

const WORKER_NAME = 'auditWorker';
const SLEEP_TIME_ONE_MINUTE = 1000 * 60

let isRunning = true;

/**
 * Update the worker state and disconnect from the database.
 *
 * @param {string} workerName - The name of the worker.
 * @param {boolean} runningState - The new running state of the worker.
 */
async function updateWorkerStateAndDisconnect(workerName, runningState) {
  try {
    await setWorkerRunningState(workerName, runningState);
    await disconnectFromDb();
  } catch (err) {
    console.error('Error updating worker running state:', err);
  }
}

/**
 * Handles stop signals for the worker.
 *
 * @param {string} workerName - The name of the worker.
 * @param {string} signal - The received signal.
 */
async function stop(workerName, signal) {
  console.log(`Received ${signal}. Flushing data before exit...`);
  isRunning = false;
  await updateWorkerStateAndDisconnect(workerName, false);
  process.exit(0);
}

/**
 * Determines if a site needs to be audited.
 *
 * @param {object} site - The site to audit.
 * @returns {Promise<boolean>} - True if the site needs an audit.
 */
async function isAuditRequired(site) {
  const lastAudited = site.lastAudited ? new Date(site.lastAudited) : null;
  const now = new Date();
  const oneDayInMilliseconds = 1000 * 60 * 60 * 24;
  const timeSinceLastAudit = lastAudited ? now - lastAudited : oneDayInMilliseconds;

  // If the time since the last audit is less than 24 hours, it does not require an audit
  if (timeSinceLastAudit < oneDayInMilliseconds) {
    console.info(`Last site audit was less than 24 hours ago. Skipping ${site.domain}.`);
    return false;
  }

  console.info(`Audit required for site ${site.domain}`);
  return true;
}

/**
 * Audit a single site, handle rate limiting and audit errors.
 *
 * @param {Object} site - The site to audit.
 * @returns {Promise<void>}
 */
async function auditSite(site) {
  try {
    const audit = await performPSICheck(site.domain);
    await saveAudit(site.domain, audit);
    console.info(`Audited ${site.domain}`);
  } catch (err) {
    if (err.response?.status === 429) {
      console.error(`Rate limit exceeded for domain ${site.domain}. Retrying after 1 minute...`);
      await sleep(SLEEP_TIME_ONE_MINUTE);
      throw err;  // Retry the same site in the main loop
    }

    const errMsg = err.response?.data?.error || err.message || err;
    console.error(`Error during site audit for domain ${site.domain}:`, errMsg);
    await saveAuditError(site.domain, errMsg);
  }
}

/**
 * The main worker function.
 *
 * @param {string} workerName - The name of the worker.
 */
async function auditWorker(workerName) {
  try {
    await connectToDb();
    await setWorkerRunningState(workerName, true);
    await createIndexes();

    console.info('Audit worker started');

    while (isRunning) {
      console.info('Starting audit cycle...');

      const site = await getNextSiteToAudit();

      if (!site) {
        console.info('No sites to audit, sleeping for 1 minute');
        await sleep(SLEEP_TIME_ONE_MINUTE);
        continue;
      }

      if (await isAuditRequired(site)) {
        try {
          await auditSite(site);
        } catch (err) {
          console.error(`Error in main audit for domain ${site.domain}:`, err);
        }
      }

      console.info('Audit cycle completed, sleeping for 1 minute');
      await sleep(SLEEP_TIME_ONE_MINUTE);
    }
  } catch (error) {
    console.error(error);
    isRunning = false;
  } finally {
    await updateWorkerStateAndDisconnect(workerName, false);
  }
}

/**
 * Handles the SIGINT signal.
 */
process.on('SIGINT', () => stop(WORKER_NAME, 'SIGINT'));

/**
 * Handles the SIGTERM signal.
 */
process.on('SIGTERM', () => stop(WORKER_NAME, 'SIGTERM'));

auditWorker(WORKER_NAME);
