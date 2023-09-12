const { log } = require('./util');

const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_ERROR_MSG = 'Rate limit exceeded';

/**
 * AuditWorker function to handle audit tasks.
 * @param {object} config - Configuration object containing audit tasks queue.
 * @param {object} dependencies - Dependencies required for audit worker including db, queue, psiClient, etc.
 * @returns {object} Object containing audit utility methods.
 */
function AuditWorker(config, dependencies) {
  const { auditTasksQueue } = config;

  const {
    db,
    queue,
    psiClient,
    githubClient,
    contentClient,
  } = dependencies;

  /**
   * Attempts to audit a single site by given siteId. It logs and stores the audit result if successful.
   * In case of an error during the audit, it logs the error and stores the error information.
   * If the audit was rate-limited, it throws an error indicating that the rate limit was exceeded.
   *
   * @param {Object} site - The site object to audit, which should contain information about the site.
   * @throws {Error} Throws an error with the message 'Rate limit exceeded' if the audit was rate-limited.
   * @returns {Promise<void>} This function does not return a value.
   */
  async function performAudit(site) {
    const {
      domain,
      gitHubURL,
      latestAudit,
    } = site;

    log('info', `Auditing ${domain}...`);

    const audit = await psiClient.performPSICheck(domain);

    console.info(JSON.stringify(audit, null, 2));

    const markdownDiff = await contentClient.fetchMarkdownDiff(latestAudit, audit?.result?.lighthouseResult?.finalUrl);
    const githubDiff = await githubClient.fetchGithubDiff(audit, latestAudit?.auditedAt, gitHubURL);

    await db.saveAudit(site, audit, markdownDiff, githubDiff);
  }

  async function handleAuditError(site, error) {
    const errMsg = error.response?.data?.error || error.message || error;
    log('error', `Error during site audit for site ${site?.domain}:`, errMsg);
    await db.saveAuditError(site, errMsg);

    if (error.response?.status === RATE_LIMIT_STATUS) {
      throw new Error(RATE_LIMIT_ERROR_MSG);
    }
  }

  async function auditSite(site) {
    if (!site._id) {
      log('warn', `Error deconstructing the message payload. '_id' does not exist!`);
    }

    let siteDocument;

    try {
      siteDocument = await db.findSiteById(site._id);
    } catch (e) {
      log('error', `Database error during site audit for site ${site.domain}:`, e.message);
      return;
    }

    try {
      const startTime = process.hrtime();
      await performAudit(siteDocument);
      const endTime = process.hrtime(startTime);
      const elapsedTime = (endTime[0] + endTime[1] / 1e9).toFixed(2);
      log('info', `Audited ${siteDocument.domain} in ${elapsedTime} seconds`);
    } catch (e) {
      await handleAuditError(siteDocument, e);
    }
  }

  async function start() {
    await db.connect();
    await queue.connect();

    // start consuming messages
    await queue.consumeMessages(auditTasksQueue, auditSite);
  }

  async function stop() {
    await db.close();
    await queue.close();
    process.exit();
  }

  return {
    handleAuditError,
    auditSite,
    start,
    stop,
  }
}

module.exports = AuditWorker;
