const { log } = require('./util');

const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_ERROR_MSG = 'Rate limit exceeded';

/**
 * Gets the domain to audit.
 *
 * @param {object} site - The site to audit.
 * @returns {string} - The domain to audit.
 */
function getDomainToAudit(site) {
  return site.isLive ? (site.prodURL || site.domain) : site.domain;
}

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
   * @param {Object} siteId - The site object to audit, which should contain information about the site.
   * @throws {Error} Throws an error with the message 'Rate limit exceeded' if the audit was rate-limited.
   * @returns {Promise<void>} This function does not return a value.
   */
  async function performAudit(siteId) {
    const site = await db.findSiteById(siteId);

    const {
      domain,
      gitHubURL,
      latestAudit,
    } = site;

    log('info', `Auditing ${domain}...`);

    const audit = await psiClient.performPSICheck(domain);
    const markdownDiff = await contentClient.fetchMarkdownDiff(latestAudit, audit);
    const githubDiff = await githubClient.fetchGithubDiff(audit, latestAudit?.auditedAt, gitHubURL);

    await db.saveAudit(site, audit, markdownDiff, githubDiff);
  }

  async function handleAuditError(error) {
    const errMsg = error.response?.data?.error || error.message || error;
    log('error', `Error during site audit for domain ${site.domain}:`, errMsg);
    await db.saveAuditError(site, errMsg);

    if (error.response?.status === RATE_LIMIT_STATUS) {
      throw new Error(RATE_LIMIT_ERROR_MSG);
    }
  }

  async function auditSite(site) {
    if (!site._id) {
      log('warn', `Error deconstructing the message payload. '_id' does not exist!`);
    }

    try {
      const startTime = process.hrtime();
      await performAudit(site._id);
      const endTime = process.hrtime(startTime);
      const elapsedTime = (endTime[0] + endTime[1] / 1e9).toFixed(2);
      log('info', `Audited ${site.domain} in ${elapsedTime} seconds`);
    } catch (e) {
      await handleAuditError(e);
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
    start,
    stop,
  }
}

module.exports = AuditWorker;
