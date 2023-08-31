const sinon = require('sinon');
const assert = require('assert');
const { log } = require('../util.js');
const AuditWorker = require('../audit-worker.js');

describe('AuditWorker', () => {
  let sandbox;
  let mockConfig, mockDependencies;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockDependencies = {
      db: {
        connect: sandbox.stub().resolves(),
        close: sandbox.stub().resolves(),
        findSiteById: sandbox.stub().resolves(),
        saveAudit: sandbox.stub().resolves(),
        saveAuditError: sandbox.stub().resolves()
      },
      queue: {
        connect: sandbox.stub().resolves(),
        close: sandbox.stub().resolves(),
        consumeMessages: sandbox.stub().resolves()
      },
      psiClient: {
        performPSICheck: sandbox.stub().resolves()
      },
      githubClient: {
        fetchGithubDiff: sandbox.stub().resolves()
      },
      contentClient: {
        fetchMarkdownDiff: sandbox.stub().resolves()
      }
    };

    sandbox.stub(process, 'exit');

    mockConfig = {
      auditTasksQueue: 'mockQueue'
    };

    sandbox.stub(console, 'info');
    sandbox.stub(console, 'error');
    sandbox.stub(console, 'warn');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDomainToAudit()', () => {
    it('should return site.prodURL if site is live and prodURL exists', () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const site = { isLive: true, prodURL: 'https://prod-url.com', domain: 'https://domain.com' };
      const result = worker.getDomainToAudit(site);
      assert.strictEqual(result, 'https://prod-url.com');
    });

    it('should return site.domain if site is live but prodURL does not exist', () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const site = { isLive: true, domain: 'https://domain.com' };
      const result = worker.getDomainToAudit(site);
      assert.strictEqual(result, 'https://domain.com');
    });

    it('should return site.domain if site is not live', () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const site = { isLive: false, prodURL: 'https://prod-url.com', domain: 'https://domain.com' };
      const result = worker.getDomainToAudit(site);
      assert.strictEqual(result, 'https://domain.com');
    });
  });

  describe('start()', () => {
    it('should connect to the database and queue and start consuming messages', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);

      await worker.start();

      assert(mockDependencies.db.connect.calledOnce);
      assert(mockDependencies.queue.connect.calledOnce);
      assert(mockDependencies.queue.consumeMessages.calledWith(mockConfig.auditTasksQueue, sinon.match.func));
    });
  });

  describe('stop()', () => {
    it('should close the database and queue connections', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);

      await worker.stop();

      assert(mockDependencies.db.close.calledOnce);
      assert(mockDependencies.queue.close.calledOnce);
      assert(process.exit.calledOnce);
    });
  });

  describe('auditSite()', () => {
    it('should handle a site with missing _id', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);

      await worker.start();
      await worker.auditSite({});

      assert(console.warn.calledWithMatch(`Error deconstructing the message payload.`));
    });

    it('should handle rate-limit errors from psiClient', async () => {
      mockDependencies.psiClient.performPSICheck.rejects({ response: { status: 429 } });

      const worker = AuditWorker(mockConfig, mockDependencies);

      await worker.start();

      try {
        await worker.auditSite({_id: '1234', domain: 'test.com'});
      } catch (error) {
        assert.strictEqual(error.message, 'Rate limit exceeded');
      }
    });

    it('should log the elapsed time when the audit is successful', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const site = { _id: '1234', domain: 'https://domain.com' };

      mockDependencies.db.findSiteById.resolves(site);

      await worker.auditSite(site);

      console.log(console.info.getCalls().map(call => call.args)); // will print all arguments for all calls

      assert(console.info.calledWithMatch(`Audited ${site.domain} in`));
    });
  });

  describe('handleAuditError()', () => {
    it('should throw a "Rate limit exceeded" error when rate limit status is encountered', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const mockSite = { domain: 'https://domain.com' };
      const mockError = {
        response: {
          status: 429
        }
      };

      try {
        await worker.handleAuditError(mockSite, mockError);
        assert.fail('Expected rate limit error to be thrown');
      } catch (error) {
        assert.strictEqual(error.message, 'Rate limit exceeded');
      }
    });

    it('should fall back to the error object itself if error.response.data.error and error.message are both undefined', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const mockSite = { domain: 'https://domain.com' };
      const mockError = {}; // Neither 'response.data.error' nor 'message' is defined

      await worker.handleAuditError(mockSite, mockError);

      // Here, we check if the logging function was called with the error object itself.
      assert(console.error.calledWithMatch('Error during site audit for domain https://domain.com:', mockError));
    });

    it('should use error.message if error.response.data.error is undefined', async () => {
      const worker = AuditWorker(mockConfig, mockDependencies);
      const mockSite = { domain: 'https://domain.com' };
      const mockError = { message: 'Some error message' };

      await worker.handleAuditError(mockSite, mockError);

      // Check if the logging function was called with error.message.
      assert(console.error.calledWithMatch('Error during site audit for domain https://domain.com:', 'Some error message'));
    });
  });
});
