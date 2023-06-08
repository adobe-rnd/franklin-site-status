const axios = require('axios');
const {
  connectToDb,
  createIndexes,
  disconnectFromDb,
  getDb,
  setWorkerRunningState,
} = require('./db');
const { cleanupOldAudits } = require('./db.js');

const WORKER_NAME = 'importWorker';
const WAIT_TIME_MS = 60 * 1000;

/**
 * Returns a promise that resolves after a specified time.
 * @param {number} ms - The number of milliseconds to wait before the promise is resolved.
 * @returns {Promise<void>} A promise that resolves after a specified time.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Stops the worker, updates its running state in the database, and disconnects from the database.
 *
 * @param {string} workerName - The name of the worker.
 * @returns {Promise<void>}
 */
async function stop(workerName) {
  console.log(`Received signal. Stopping ${workerName}...`);
  await setWorkerRunningState(workerName, false);
  await disconnectFromDb();
  process.exit(0);
}

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
 * Processes a single repository from the GitHub API response, synchronizing it with the database.
 * If the repository is archived, it removes the associated site from the database.
 * Otherwise, it constructs the domain for the repository and updates/inserts relevant data
 * into the MongoDB collection.
 *
 * @param {Object} repo - The repository object from GitHub API.
 * @param {string} githubOrg - The GitHub organization name.
 * @param {string} authHeaderValue - The Authorization header value for GitHub API requests.
 * @param {Object} sitesCollection - The MongoDB collection where site data is stored.
 * @param {Array} bulkOps - The array to store bulk operations to perform on the sites collection.
 * @returns {Promise<void>}
 */
async function processRepository(repo, githubOrg, authHeaderValue, sitesCollection, bulkOps) {
  if (repo.archived) {
    console.info(`Repo ${repo.name} is archived. Removing associated site from database.`);
    await sitesCollection.deleteOne({ githubId: repo.id }).catch(err => console.error(err));
    return;
  }

  const domain = `main--${repo.name}--${githubOrg}.hlx.live`;

  const now = new Date();

  let updateOperation = {
    $setOnInsert: {
      githubId: repo.id,
      createdAt: now,
      lastAudited: null,
      prodDomain: null,
      isLive: false,
      audits: [],
    },
    $set: {
      domain: domain,
      gitHubURL: repo.html_url,
      gitHubOrg: githubOrg
    },
    $currentDate: {
      updatedAt: true
    },
  };

  bulkOps.push({
    updateOne: {
      filter: { githubId: repo.id },
      update: updateOperation,
      upsert: true,
    },
  });

  console.info(`Synced ${domain} domain to sites collection.`);
}

/**
 * Iteratively fetches and processes repositories from the GitHub API. Fetches a page of repositories,
 * processes each repository, and continues to the next page until all pages have been processed.
 * Performs bulk writes to the MongoDB collection to optimize database write operations.
 *
 * @param {string} githubOrg - The GitHub organization name.
 * @param {string} authHeaderValue - The Authorization header value for GitHub API requests.
 * @param {Object} sitesCollection - The MongoDB collection where site data is stored.
 * @param {Array} bulkOps - The array to store bulk operations to perform on the sites collection.
 * @returns {Promise<void>}
 */
async function fetchAndProcessRepositories(githubOrg, authHeaderValue, sitesCollection, bulkOps) {
  let page = 1;
  let hasMorePages = true;
  while (hasMorePages) {
    try {
      const apiUrl = createGithubApiUrl(githubOrg, page);
      const response = await axios.get(apiUrl, { headers: { 'Authorization': authHeaderValue } });
      const repos = response.data;

      const linkHeader = response.headers.link;
      if (linkHeader) {
        const links = linkHeader.split(',').map(linkInfo => linkInfo.split('; '));
        const nextLink = links.find(link => link[1] === 'rel="next"');
        hasMorePages = Boolean(nextLink);
      } else {
        hasMorePages = false;
      }

      console.info(`Fetched ${repos.length} repos from Github page ${page}.`);

      await Promise.all(repos.map(repo => {
        console.info(`Processing repo id: ${repo.id} name: ${repo.name}`);
        return processRepository(repo, githubOrg, authHeaderValue, sitesCollection, bulkOps);
      }));

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
async function importWorker(workerName) {
  try {
    const githubId = process.env.GITHUB_CLIENT_ID;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET;
    const githubOrg = process.env.GITHUB_ORG;

    if (!githubId || !githubSecret || !githubOrg) {
      throw new Error('Invalid configuration');
    }

    await connectToDb();
    await createIndexes();

    const db = getDb();
    const sitesCollection = db.collection('sites');

    await setWorkerRunningState(workerName, true);

    const authHeaderValue = createGithubAuthHeaderValue(githubId, githubSecret);

    const bulkOps = [];

    await fetchAndProcessRepositories(githubOrg, authHeaderValue, sitesCollection, bulkOps);

    await cleanupOldAudits();
    await setWorkerRunningState(workerName, false);
    await disconnectFromDb();

  } catch (err) {
    console.error('Error in import worker: ', err);
  }
}

process.on('SIGINT', () => stop(WORKER_NAME));
process.on('SIGTERM', () => stop(WORKER_NAME));

importWorker(WORKER_NAME);
