const DB = require('./db');
const Queue = require('./queue');
const PSIClient = require('./psi-client');
const GithubClient = require('./github-client');
const ContentClient = require('./content-client');
const AuditWorker = require('./audit-worker');

const {
  MONGODB_URI,
  DB_NAME,
  RABBITMQ_USERNAME,
  RABBITMQ_PASSWORD,
  RABBITMQ_SERVICE_SERVICE_HOST,
  RABBITMQ_SERVICE_SERVICE_PORT,
  PAGESPEED_API_KEY,
  PAGESPEED_API_BASE_URL,
  GITHUB_API_BASE_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  AUDIT_TASKS_QUEUE_NAME,
} = process.env;

const dbConfig = { mongodbUri: MONGODB_URI, dbName: DB_NAME };
const rabbitMQConfig = {
  username: RABBITMQ_USERNAME,
  password: RABBITMQ_PASSWORD,
  host: RABBITMQ_SERVICE_SERVICE_HOST,
  port: RABBITMQ_SERVICE_SERVICE_PORT,
};

const pagespeedApiConfig = {
  apiKey: PAGESPEED_API_KEY,
  baseUrl: PAGESPEED_API_BASE_URL,
};

const githubApiConfig = {
  apiKey: GITHUB_API_BASE_URL,
  githubId: GITHUB_CLIENT_ID,
  githubSecret: GITHUB_CLIENT_SECRET,
};

const auditWorkerConfig = {
  auditTasksQueue: AUDIT_TASKS_QUEUE_NAME,
}

// initialize dependencies
const db = DB(dbConfig);
const queue = Queue(rabbitMQConfig);
const psiClient = PSIClient(pagespeedApiConfig);
const githubClient = GithubClient(githubApiConfig);
const contentClient = ContentClient();

// initialize the worker
const worker = AuditWorker(auditWorkerConfig, { db, queue, psiClient, githubClient, contentClient });

(async () => {
  // set up exit hooks
  process.on('SIGINT', async () => {
    console.log('Received SIGINT. Closing worker...');
    await worker.stop();
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Closing worker...');
    await worker.stop()
  });

  // start the worker
  await worker.start();
})();
