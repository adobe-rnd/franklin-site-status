const sinon = require('sinon');
const assert = require('assert');
const DB = require('../db.js');
const { ObjectId } = require('mongodb');

describe('DB Module', () => {
  let sandbox;
  let mockCollection;
  let mockClient;
  let dbInstance; // Initialize a single dbInstance for all tests

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockCollection = {
      createIndex: sandbox.stub().resolves(),
      insertOne: sandbox.stub().resolves(),
      aggregate: sandbox.stub().returns({
        toArray: sandbox.stub(),
      }),
    };

    mockClient = {
      connect: sandbox.stub().resolves(),
      close: sandbox.stub().resolves(),
      db: sandbox.stub().returns({
        collection: sandbox.stub().returns(mockCollection)
      }),
    };

    // Now, instantiate the DB with the mock configuration
    dbInstance = DB({ mongodbUri: 'mock-uri', dbName: 'mock-db' });

    // Now use the exposed method to set the mock client for testing
    dbInstance.setMongoClient(mockClient);
  });

  afterEach(() => {
    sandbox.restore();
  });

  // The tests remain mostly unchanged. Just remove the dbInstance instantiation from each one.

  describe('connect()', () => {
    it('should log a successful connection', async () => {
      const logStub = sinon.stub(console, 'info');

      await dbInstance.connect();

      const firstMessage = logStub.getCall(0).args[0];  // Adjusted to get the first argument
      const secondMessage = logStub.getCall(1).args[0]; // Adjusted to get the first argument

      assert.equal(logStub.callCount, 2, "Expected the log function to be called twice");
      assert(firstMessage.includes('Database connection established.'), `Unexpected first log message: ${firstMessage}`);
      assert(secondMessage.includes('Indexes created successfully'), `Unexpected second log message: ${secondMessage}`);
    });

    it('should log an error on connection failure', async () => {
      const logStub = sinon.stub(console, 'error');

      mockClient.connect.rejects(new Error('Connection Error'));

      try {
        await dbInstance.connect();
        assert.fail('Expected connection to fail.');
      } catch (e) {
        assert(logStub.calledWithMatch('Error connecting to database: ', e));
      }
    });
  });

  describe('close()', () => {
    it('should close the database connection', async () => {
      await dbInstance.connect(); // Assumption that connection should be opened first
      await dbInstance.close();
      assert(mockClient.close.calledOnce, "Expected the client's close method to be called");
    });

    it('should log an error if closing the database connection fails', async () => {
      mockClient.close.rejects(new Error('Close Connection Error'));

      await dbInstance.connect(); // Ensure the connection is opened first
      await dbInstance.close();

      assert(console.error.calledWithMatch('Error closing MongoDB connection:', sinon.match.instanceOf(Error)));
    });
  });

  describe('createIndexes()', () => {
    it('should log an error if index creation fails', async () => {
      mockCollection.createIndex.rejects(new Error('Indexing Error'));

      await dbInstance.connect();

      assert(console.error.calledWithMatch('Error creating indexes: ', sinon.match.instanceOf(Error)));
    });
  });

  describe('saveAudit()', () => {
    it('should save the provided audit', async () => {
      const mockSite = { _id: new ObjectId().toString(), domain: 'test.com', isLive: true };
      const mockAudit = { lighthouseResult: {} };
      const mockMarkdownContext = { diff: 'diff', content: 'content' };
      const mockGithubDiff = 'github diff';

      await dbInstance.connect();

      await dbInstance.saveAudit(mockSite, mockAudit, mockMarkdownContext, mockGithubDiff);

      assert(console.info.calledWithMatch(`Audit for domain ${mockSite.domain} saved successfully at ${new Date()}`));
    });

    it('should log an error if saving audit fails', async () => {
      mockCollection.insertOne.rejects(new Error('Insertion Error'));

      const mockSite = { _id: new ObjectId().toString(), domain: 'test.com', isLive: true };
      const mockAudit = { lighthouseResult: {} };
      const mockMarkdownContext = { diff: 'diff', content: 'content' };
      const mockGithubDiff = 'github diff';

      await dbInstance.connect();

      await dbInstance.saveAudit(mockSite, mockAudit, mockMarkdownContext, mockGithubDiff);

      assert(console.error.calledWithMatch('Error saving audit: ', sinon.match((value) => {
        return value instanceof Error && value.message === 'Insertion Error';
      })));
    });
  });

  describe('saveAuditError()', () => {
    it('should save an audit error', async () => {
      const mockSite = { _id: new ObjectId().toString(), domain: 'test.com' };
      const mockError = new Error('Audit Error');

      await dbInstance.connect();

      await dbInstance.saveAuditError(mockSite, mockError);

      assert(mockCollection.insertOne.calledOnce);

      const savedError = mockCollection.insertOne.firstCall.args[0];
      assert.equal(savedError.isError, true);
      assert.equal(savedError.errorMessage, 'Audit Error');
    });
  });

  describe('findSiteById()', () => {
    it('should return the site with the specified ID', async () => {
      const mockSiteId = new ObjectId().toString();
      const mockSite = {
        _id: mockSiteId,
        domain: 'test.com',
        gitHubURL: 'https://github.com/test',
      };

      mockCollection.aggregate().toArray.resolves([mockSite]);

      await dbInstance.connect();

      const result = await dbInstance.findSiteById(mockSiteId);

      assert.deepStrictEqual(result, mockSite);
    });

    it('should return undefined if the site is not found', async () => {
      const mockSiteId = new ObjectId().toString();

      mockCollection.aggregate().toArray.resolves([]);

      await dbInstance.connect();
      const result = await dbInstance.findSiteById(mockSiteId);

      assert.strictEqual(result, undefined);
    });

    it('should log an error if fetching the site fails', async () => {
      mockCollection.aggregate.throws(new Error('Aggregation Error'));

      await dbInstance.connect();
      await dbInstance.findSiteById(new ObjectId().toString());

      assert(console.error.calledWithMatch('Error getting site by site id:', 'Aggregation Error'));
    });
  });
});
