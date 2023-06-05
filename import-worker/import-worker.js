const axios = require('axios');
const url = require('url');
const { connectToDb, disconnectFromDb, getDb, setWorkerRunningState } = require('./db');
const { cleanupOldAudits } = require('./db.js');

const WORKER_NAME = 'importWorker';

/**
 * Returns a promise that resolves after a specified time.
 * @param {number} ms - The number of milliseconds to wait before the promise is resolved.
 * @returns {Promise<void>} A promise that resolves after a specified time.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Creates a URL for the GitHub API.
 * @param {string} githubOrg - The name of the GitHub organization.
 * @param {number} page - The page number for pagination.
 * @returns {string} The created GitHub API URL.
 */
function createGithubApiUrl(githubOrg, page) {
  return `https://api.github.com/orgs/${githubOrg}/repos?type=public&page=${page}&per_page=100`;
}

function createGithubAuthHeaderValue(githubId, githubSecret) {
  if (!githubId || !githubSecret) {
    throw new Error('GitHub credentials not provided');
  }
  return `Basic ${Buffer.from(`${githubId}:${githubSecret}`).toString('base64')}`;
}

async function importWorker() {
  try {
    const githubId = process.env.GITHUB_CLIENT_ID;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET;
    const githubOrg = process.env.GITHUB_ORG;

    if (!githubId || !githubSecret || !githubOrg) {
      throw new Error('Environment variables not set properly');
    }

    await connectToDb();

    const db = getDb();
    const sitesCollection = db.collection('sites');

    await setWorkerRunningState(WORKER_NAME, true);

    const authHeaderValue = createGithubAuthHeaderValue(githubId, githubSecret);

    let page = 1;
    let hasMorePages = true;
    const bulkOps = [];

    while (hasMorePages) {
      try {
        const apiUrl = createGithubApiUrl(githubOrg, page);
        const response = await axios.get(apiUrl, { headers: { 'Authorization': authHeaderValue } });
        const repos = response.data;
        hasMorePages = Boolean(response.headers.link?.includes('rel="next"'));

        for (const repo of repos) {
          const siteUrl = repo.homepage || `https://main--${repo.name}--${githubOrg}.hlx.live`;

          let domain;
          try {
            domain = new url.URL(siteUrl).hostname;
          } catch (error) {
            console.error(`Invalid URL for repo ${repo.name}: ${siteUrl}`);
            continue;
          }

          if (!domain) {
            console.error(`No domain could be extracted from URL for repo ${repo.name}: ${siteUrl}`);
            continue;
          }

          const now = new Date();

          bulkOps.push({
            updateOne: {
              filter: { domain: domain },
              update: {
                $setOnInsert: {
                  gitHubURL: repo.html_url,
                  gitHubOrg: githubOrg,
                  createdAt: now,
                  lastAudited: null,
                  audits: [],
                },
                $currentDate: {
                  updatedAt: true
                }
              },
              upsert: true,
            },
          });

          console.info(`Added ${domain} to sites collection.`);
        }

        if (bulkOps.length > 0) {
          await sitesCollection.bulkWrite(bulkOps, { ordered: false });
          bulkOps.length = 0;
        }

        page++;
      } catch (err) {
        console.error('Error in fetching repos from Github', err);
        await sleep(1000 * 60);
      }
    }

    await cleanupOldAudits();
    await setWorkerRunningState(WORKER_NAME, false);
    await disconnectFromDb();

  } catch (err) {
    console.error('Error in import worker: ', err);
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

importWorker();
