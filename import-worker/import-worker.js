const axios = require('axios');
const url = require('url');
const { connectToDb, getDb, setWorkerRunningState } = require('.//db');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function importWorker() {
  // Connecting to database
  await connectToDb();

  const db = getDb();

  await setWorkerRunningState('importWorker', true);

  const sitesCollection = db.collection('sites');

  const githubId = process.env.GITHUB_CLIENT_ID;
  const githubSecret = process.env.GITHUB_CLIENT_SECRET;
  const githubOrg = process.env.GITHUB_ORG;
  const authHeaderValue = `Basic ${Buffer.from(`${githubId}:${githubSecret}`).toString('base64')}`;

  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    try {
      const response = await axios.get(
        `https://api.github.com/orgs/${githubOrg}/repos?type=public&page=${page}&per_page=100`,
        {
          headers: {
            'Authorization': authHeaderValue
          }
        }
      );
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

        await sitesCollection.updateOne(
          { domain: domain },
          {
            $setOnInsert: {
              domain: domain,
              gitHubURL: repo.html_url,
              gitHubOrg: githubOrg,
              createdAt: new Date(),
              lastAudited: null,
            }
          },
          { upsert: true }
        );

        console.info(`Added ${domain} to sites collection.`)
      }

      page++;
    } catch (err) {
      console.error('Error in fetching repos from Github', err);
      await sleep(1000 * 60);
    }
  }

  await setWorkerRunningState('importWorker', false);
}

importWorker().catch(console.error);
