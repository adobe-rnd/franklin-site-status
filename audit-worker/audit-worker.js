const { log } = require('./util');

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

    log('info', `Auditing ${domain} (live: ${site.isLive})...`);

    const startTime = Date.now();

    try {
      const latestAudit = await db.getLatestAuditBySiteId(site._id);
      const audit = await psiClient.performPSICheck(domain);
      const markdownDiff = await contentClient.fetchMarkdownDiff(latestAudit, audit);
      const githubDiff = await githubClient.fetchGithubDiff(audit, latestAudit?.auditedAt, site.gitHubURL);

      await db.saveAudit(site, audit, markdownDiff, githubDiff);

      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // in seconds

      log('info', `Audited ${site.domain} in ${elapsedTime.toFixed(2)} seconds`);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || err;
      log('error', `Error during site audit for domain ${site.domain}:`, errMsg);
      await db.saveAuditError(site, errMsg);

      if (err.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
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
