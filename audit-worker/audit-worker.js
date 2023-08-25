const amqp = require('amqplib');

const {
  connectToDb,
  disconnectFromDb,
  createIndexes,
  getLatestAuditBySiteId,
  saveAudit,
  saveAuditError,
} = require('./db');
const {
  performPSICheck,
  log,
} = require('./util');
const { fetchMarkdownDiff, fetchGithubDiff } = require('./util.js');

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
    const latestAudit = await getLatestAuditBySiteId(site._id);
    const audit = await performPSICheck(domain);
    const markdownDiff = await fetchMarkdownDiff(latestAudit, audit);
    const githubDiff = await fetchGithubDiff(audit, latestAudit.auditedAt, site.gitHubURL, githubId, githubSecret);

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

let connection;

async function consumeMessages() {
  try {
    const username = process.env.RABBITMQ_USERNAME;
    const password = process.env.RABBITMQ_PASSWORD;
    const host = process.env.RABBITMQ_SERVICE_SERVICE_HOST;
    const port = process.env.RABBITMQ_SERVICE_SERVICE_PORT;
    const queue = process.env.AUDIT_TASKS_QUEUE_NAME;

    const connectionURL = `amqp://${username}:${password}@${host}:${port}`;
    connection = await amqp.connect(connectionURL);

    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    console.log('Waiting for messages. To exit press CTRL+C');

    channel.consume(queue, async (message) => {
      if (message !== null) {
        const content = message.content.toString();
        console.debug(`Received message: ${content}`);

        const site = JSON.parse(content);

        // perform audit
        await auditSite(site);

        // acknowledge the message to remove it from the queue
        // manual ack for all now, we can play with auto ack/nack + redelivery settings later on
        channel.ack(message);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing worker...');
  await cleanup();
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Closing worker...');
  await cleanup();
});

async function cleanup() {
  await disconnectFromDb();

  if (connection) {
    await connection.close();
  }
  console.log('Worker closed');
  process.exit();
}

(async () => {
  // connect to db
  await connectToDb();
  await createIndexes();

  // start consuming messages
  await consumeMessages();
})();
