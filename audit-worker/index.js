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

const config = {
  db: {
    mongodbUri: MONGODB_URI,
    dbName: DB_NAME
  },
  rabbitMQ: {
    username: RABBITMQ_USERNAME,
    password: RABBITMQ_PASSWORD,
    host: RABBITMQ_SERVICE_SERVICE_HOST,
    port: RABBITMQ_SERVICE_SERVICE_PORT,
  },
  pagespeedApi: {
    apiKey: PAGESPEED_API_KEY,
    baseUrl: PAGESPEED_API_BASE_URL,
  },
  githubApi: {
    baseUrl: GITHUB_API_BASE_URL,
    githubId: GITHUB_CLIENT_ID,
    githubSecret: GITHUB_CLIENT_SECRET,
  },
  auditWorker: {
    auditTasksQueue: AUDIT_TASKS_QUEUE_NAME,
  }
};

// initialize dependencies
const db = DB(config.db);
const queue = Queue(config.rabbitMQ);
const psiClient = PSIClient(config.pagespeedApi);
const githubClient = GithubClient(config.githubApi);
const contentClient = ContentClient();

// initialize the worker
const worker = AuditWorker(config.auditWorker, { db, queue, psiClient, githubClient, contentClient });

(async () => {
  // set up exit hooks
  const exitHandler = async (signal) => {
    console.log(`Received ${signal}. Closing worker...`);
    await worker.stop();
  };

  process.on('SIGINT', exitHandler.bind(null, 'SIGINT'));
  process.on('SIGTERM', exitHandler.bind(null, 'SIGTERM'));

  // start the worker
  await worker.start();
})();
