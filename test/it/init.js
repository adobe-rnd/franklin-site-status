const amqp = require('amqplib');

const DB = require('../../audit-worker/db');
const Queue = require('../../audit-worker/queue');
const AuditWorker = require('../../audit-worker/audit-worker');

const sites = require('./data/sites.json');
const pagespeedResult1 = require('./data/pagespeed_result1.json');
const pagespeedResult2 = require('./data/pagespeed_result2.json');
const pagespeedResult3 = require('./data/pagespeed_result3.json');
const auditTasksQueue = 'tasks';

module.exports.createAuditWorker = (mongodbUri, rabbitHost, rabbitPort, sandbox) => {
  const dbConfig = { mongodbUri, dbName: 'testdb' };
  const rabbitMQConfig = {
    username: 'username',
    password: 'password',
    host: rabbitHost,
    port: rabbitPort,
  };

  const auditWorkerConfig = {
    auditTasksQueue,
  }

  // initialize dependencies
  const db = DB(dbConfig);
  const queue = Queue(rabbitMQConfig);

  const performPSICheckStub = sandbox.stub();
  performPSICheckStub.withArgs('blog.adobe.com').resolves(pagespeedResult1);
  performPSICheckStub.withArgs('bamboohr.com').resolves(pagespeedResult2);
  performPSICheckStub.withArgs('aerotop-sg.com').resolves(pagespeedResult3);
  const psiClient = {
    performPSICheck: performPSICheckStub,

  }
  const githubClient = {
    fetchGithubDiff: sandbox.stub().resolves('githubdiff'),
  }

  const contentClient = {
    fetchMarkdownDiff: sandbox.stub().resolves({ diff: 'markdowndiff', content: 'markdowncontent' }),
  }

  return AuditWorker(auditWorkerConfig, { db, queue, psiClient, githubClient, contentClient });
}

module.exports.publishMessages = async (rabbitHost, rabbitPort) => {
  // Create connection and channel
  const connection = await amqp.connect(`amqp://username:password@${rabbitHost}:${rabbitPort}`);
  channel = await connection.createChannel();
  await channel.assertQueue(auditTasksQueue, { durable: true });

  for (const message of sites) {
    await channel.sendToQueue(auditTasksQueue, Buffer.from(JSON.stringify(message)));
  }

  await channel.close();
  await connection.close();
}
