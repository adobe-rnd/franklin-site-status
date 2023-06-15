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
  sleep,
  log,
} = require('./util');
const { fetchMarkdownDiff, fetchGithubDiff } = require('./util.js');

const WORKER_NAME = 'auditWorker';

const AUDIT_INTERVAL_IN_HOURS = process.env.AUDIT_INTERVAL_IN_HOURS ? parseFloat(process.env.AUDIT_INTERVAL_IN_HOURS) : 24;
const AUDIT_INTERVAL_IN_MILLISECONDS = AUDIT_INTERVAL_IN_HOURS * 60 * 60 * 1000;
const INITIAL_SLEEP_TIME = 1000 * 60;

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
    log('error', 'Error updating worker running state:', err);
  }
}

/**
 * Handles stop signals for the worker.
 *
 * @param {string} workerName - The name of the worker.
 * @param {string} signal - The received signal.
 */
async function stop(workerName, signal) {
  log('info', `Received ${signal}. Flushing data before exit...`);
  isRunning = false;
  await updateWorkerStateAndDisconnect(workerName, false);
}

/**
 * Determines if a site needs to be audited.
 *
 * @param {object} site - The site to audit.
 * @returns {Promise<boolean>} - True if the site needs an audit.
 */
async function isAuditRequired(site) {
  const now = new Date();
  const lastAudited = site.lastAudited ? new Date(site.lastAudited) : null;

  log('info', `Last audit for ${site.domain}: ${lastAudited}`);

  const timeSinceLastAudit = lastAudited ? now - lastAudited : AUDIT_INTERVAL_IN_MILLISECONDS;
  const timeRemaining = AUDIT_INTERVAL_IN_MILLISECONDS - timeSinceLastAudit;

  if (timeSinceLastAudit < AUDIT_INTERVAL_IN_MILLISECONDS) {
    log('info', `Last site audit for ${site.domain} was less than ${AUDIT_INTERVAL_IN_HOURS} hours ago. Skipping. Next audit in ${(timeRemaining / (1000 * 60 * 60)).toFixed(2)} hours.`);
    return false;
  }

  log('info', `Audit required for site ${site.domain}. Current audit interval: ${AUDIT_INTERVAL_IN_HOURS} hours.`);
  return true;
}

/**
 * Gets the domain to audit.
 *
 * @param {object} site - The site to audit.
 * @returns {string} - The domain to audit.
 */
function getDomainToAudit(site) {
  return site.isLive ? (site.prodURL || site.domain) : site.domain;
}

/**
 * Attempts to audit a single site. It logs and stores the audit result if successful.
 * In case of an error during the audit, it logs the error and stores the error information.
 * If the audit was rate-limited, it throws an error indicating that the rate limit was exceeded.
 *
 * @param {Object} site - The site object to audit, which should contain information about the site.
 * @throws {Error} Throws an error with the message 'Rate limit exceeded' if the audit was rate-limited.
 * @returns {Promise<void>} This function does not return a value.
 */
async function auditSite(site) {
  const domain = getDomainToAudit(site);
  const githubId = process.env.GITHUB_CLIENT_ID;
  const githubSecret = process.env.GITHUB_CLIENT_SECRET;

  log('info', `Auditing ${domain} (live: ${site.isLive})...`);

  const startTime = Date.now();

  try {
    const audit = await performPSICheck(domain);
    const markdownDiff = await fetchMarkdownDiff(site, audit);
    const githubDiff = await fetchGithubDiff(site, audit, githubId, githubSecret);

    await saveAudit(site, audit, markdownDiff, githubDiff);

    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000; // in seconds

    log('info', `Audited ${site.domain} in ${elapsedTime.toFixed(2)} seconds`);
  } catch (err) {
    const errMsg = err.response?.data?.error || err.message || err;
    log('error', `Error during site audit for domain ${site.domain}:`, errMsg);
    await saveAuditError(site.domain, errMsg);

    if (err.response?.status === 429) {
      throw new Error('Rate limit exceeded');
    }
  }
}

/**
 * The main worker function that continuously audits sites. It connects to the database,
 * sets the worker running state, and creates indexes. Then, it enters an infinite loop where it
 * attempts to audit sites. If a site is not available for audit or does not need an audit,
 * it sleeps for a specified duration before the next cycle. If a site is rate-limited,
 * the function employs an exponential back-off strategy.
 *
 * @param {string} workerName - The name of the worker.
 * @returns {Promise<void>} This function does not return a value.
 */
async function auditWorker(workerName) {
  let sleepTime = INITIAL_SLEEP_TIME;

  try {
    await connectToDb();
    await setWorkerRunningState(workerName, true);
    await createIndexes();

    log('info', `Audit worker started with interval ${AUDIT_INTERVAL_IN_HOURS}/${process.env.AUDIT_INTERVAL_IN_HOURS} hours`);

    while (isRunning) {
      log('info', 'Starting audit cycle...');

      const site = await getNextSiteToAudit();

      if (!site) {
        log('info', `No sites to audit, sleeping for ${sleepTime / 1000} seconds`);
      } else if (await isAuditRequired(site)) {
        try {
          await auditSite(site);
          sleepTime = INITIAL_SLEEP_TIME; // Reset sleep time if audit is successful
        } catch (err) {
          log('error', `Error in main audit for domain ${site.domain}:`, err);
          if (err.message === 'Rate limit exceeded') {
            sleepTime *= 2; // Exponential back-off
          }
        }
      }

      log('info', `Audit cycle completed, sleeping for ${sleepTime / 1000} seconds`);
      await sleep(sleepTime);
    }
  } catch (error) {
    log('error', error);
    isRunning = false;
  } finally {
    await updateWorkerStateAndDisconnect(workerName, false);
  }
}

process.on('SIGINT', () => stop(WORKER_NAME, 'SIGINT'));

process.on('SIGTERM', () => stop(WORKER_NAME, 'SIGTERM'));

auditWorker(WORKER_NAME);
