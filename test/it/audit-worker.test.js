const { GenericContainer } = require('testcontainers');
const { MongoClient } = require('mongodb');
const sinon = require('sinon');

const { createAuditWorker, publishMessages } = require('./init');

const sandbox = sinon.createSandbox();

describe('Integration Test', () => {
  let mongoContainer;
  let rabbitContainer;
  let mongoClient;
  let auditWorker;

  before(async () => {
    // Start MongoDB container
    mongoContainer = await new GenericContainer('mongo')
      .withExposedPorts(27017)
      .start();

    // Start RabbitMQ container
    rabbitContainer = await new GenericContainer('rabbitmq:3.9.5-management')
      .withExposedPorts(5672)
      .withExposedPorts(15672)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: 'username',
        RABBITMQ_DEFAULT_PASS: 'password',
      })
      .start();

    const mongoHost = mongoContainer.getHost();
    const mongoPort = mongoContainer.getMappedPort(27017);
    const mongoUri = `mongodb://${mongoHost}:${mongoPort}`;
    mongoClient = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

    const rabbitHost = rabbitContainer.getHost();
    const rabbitPort = rabbitContainer.getMappedPort(5672);
    const rabbitMgmtPort = rabbitContainer.getMappedPort(15672);

    console.log(`mongo port: ${mongoPort}`);
    console.log(`mgm port: ${rabbitMgmtPort}`);

    auditWorker = createAuditWorker(mongoUri, rabbitHost, rabbitPort, sandbox);
    await publishMessages(rabbitHost, rabbitPort);
  });

  after(async () => {
    // Clean up
    await mongoContainer.stop();
    await rabbitContainer.stop();
    await network.stop();
  });

  it('should process data and validate audits collection', async () => {

    await auditWorker.start();

    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Connect to the test MongoDB database

    await mongoClient.connect();
    const db = mongoClient.db('testdb');

    // Initialize MongoDB with initial data
    const audits = await db.collection('audits').find().toArray();

    // checks/assertions to be added
  });
});
