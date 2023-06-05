const axios = require('axios');
const { connectToDb, disconnectFromDb, getDb, setWorkerRunningState } = require('./db');
const { cleanupOldAudits } = require('./db.js'); // removed unused `removeSite`

const WORKER_NAME = 'importWorker';
const WAIT_TIME_MS = 60 * 1000; // Replaced magic number with a named constant

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

/**
 * Creates a Basic Authentication header value from a given GitHub ID and secret.
 *
 * @param {string} githubId - The GitHub client ID.
 * @param {string} githubSecret - The GitHub client secret.
 * @returns {string} - The Basic Authentication header value.
 * @throws {Error} - Throws an error if GitHub credentials are not provided.
 */
function createGithubAuthHeaderValue(githubId, githubSecret) {
  if (!githubId || !githubSecret) {
    throw new Error('GitHub credentials not provided');
  }
  return `Basic ${Buffer.from(`${githubId}:${githubSecret}`).toString('base64')}`;
}

/**
 * Connects to a database and imports data from a GitHub organization's public repositories.
 * It fetches data page by page until no more pages are available. For each repository,
 * if it's archived, the associated site is removed from the database. If not, the repository's
 * domain is extracted and added to the database along with other repository details.
 *
 * If any errors occur while fetching repositories from GitHub, the function waits for a period
 * of time and then tries again. If an error occurs while importing data, it logs the error and
 * ends the function.
 *
 * When all data has been imported, it cleans up old audits, sets the worker running state to false,
 * and disconnects from the database.
 *
 * @returns {Promise<void>}
 */
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
        hasMorePages = Boolean(repos.length);

        console.info(`Fetched ${repos.length} repos from Github page ${page}.`);

        for (const repo of repos) {
          if (repo.archived) {
            console.info(`Repo ${repo.name} is archived. Removing associated site from database.`);
            await sitesCollection.deleteOne({ githubId: repo.id }).catch(err => console.error(err));
            continue;
          }

          const siteUrl = repo.homepage || `https://main--${repo.name}--${githubOrg}.hlx.live`;

          let domain;
          try {
            domain = new URL(siteUrl).hostname;
          } catch (error) {
            console.error(`Invalid URL for repo ${repo.name}: ${siteUrl}`);
            continue;
          }

          if (!domain) {
            console.error(`No domain could be extracted from URL for repo ${repo.name}: ${siteUrl}`);
            continue;
          }

          const now = new Date();
          const existingDoc = await sitesCollection.findOne({ githubId: repo.id });

          let updateOperation = {
            $setOnInsert: {
              githubId: repo.id,
              gitHubURL: repo.html_url,
              gitHubOrg: githubOrg,
              domain: domain,
              createdAt: now,
              lastAudited: null,
              audits: [],
            },
            $currentDate: {
              updatedAt: true
            },
          };

          if (existingDoc && (existingDoc.gitHubOrg !== githubOrg || existingDoc.domain !== domain)) {
            console.info(`Organization, or domain has changed. Updating the document in the database.`);
            updateOperation = {
              ...updateOperation,
              $set: { domain: domain, gitHubURL: repo.html_url, gitHubOrg: githubOrg }
            };
          }

          bulkOps.push({
            updateOne: {
              filter: { githubId: repo.id },
              update: updateOperation,
              upsert: true,
            },
          });

          console.info(`Synced ${domain} domain to sites collection.`);
        }

        if (bulkOps.length > 0) {
          await sitesCollection.bulkWrite(bulkOps, { ordered: false }).catch(err => console.error(err));
          console.info(`Bulk writing ${bulkOps.length} documents to database.`);
          bulkOps.length = 0;
        }

        page++;
      } catch (err) {
        console.error('Error in fetching repos from Github', err);
        await sleep(WAIT_TIME_MS);
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
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Flushing data before exit...');
  process.exit(0);
});

importWorker();
