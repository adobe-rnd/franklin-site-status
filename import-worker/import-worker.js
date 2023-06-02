const axios = require('axios');
const url = require('url');
const { connectToDb, getDb, setWorkerRunningState } = require('./db');
const { cleanupOldAudits } = require('./db.js');

const WORKER_NAME = 'importWorker';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createGithubApiUrl(githubOrg, page) {
  return `https://api.github.com/orgs/${githubOrg}/repos?type=public&page=${page}&per_page=100`;
}

function createGithubAuthHeaderValue(githubId, githubSecret) {
  return `Basic ${Buffer.from(`${githubId}:${githubSecret}`).toString('base64')}`;
}

async function importWorker() {
  await connectToDb();

  const db = getDb();
  const sitesCollection = db.collection('sites');
  const githubId = process.env.GITHUB_CLIENT_ID;
  const githubSecret = process.env.GITHUB_CLIENT_SECRET;
  const githubOrg = process.env.GITHUB_ORG;

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
              $set: {
                domain: domain, // updating domain every time
              },
              $currentDate: {
                updatedAt: true // setting updatedAt to the current date/time during an update operation
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
}

importWorker().catch(console.error);
