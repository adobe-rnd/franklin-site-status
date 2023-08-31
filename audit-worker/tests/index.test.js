const sinon = require('sinon');
const assert = require('assert');

// Pre-load modules to ensure they exist in the require.cache
require('../db.js');
require('../queue.js');
require('../psi-client.js');
require('../github-client.js');
require('../content-client.js');
require('../audit-worker.js');

describe('index.js', () => {
  let dbInstance, queueInstance, psiClientInstance, githubClientInstance, contentClientInstance, workerInstance;

  beforeEach(() => {
    // Mock the dependencies

    // Queue
    queueInstance = sinon.stub();
    sinon.stub(require.cache[require.resolve('../queue.js')], 'exports').value(queueInstance);

    // PSI Client
    psiClientInstance = sinon.stub();
    sinon.stub(require.cache[require.resolve('../psi-client.js')], 'exports').value(psiClientInstance);

    // Github Client
    githubClientInstance = sinon.stub();
    sinon.stub(require.cache[require.resolve('../github-client.js')], 'exports').value(githubClientInstance);

    // Content Client
    contentClientInstance = sinon.stub();
    sinon.stub(require.cache[require.resolve('../content-client.js')], 'exports').value(contentClientInstance);

    // Audit Worker
    workerInstance = {
      start: sinon.stub(),
      stop: sinon.stub()
    };
    sinon.stub(require.cache[require.resolve('../audit-worker.js')], 'exports').value(() => workerInstance);
  });

  afterEach(() => {
    sinon.restore();
    // Remove the cached index.js module, so it's reloaded fresh in the next test
    delete require.cache[require.resolve('../index.js')];
  });

  it('should initialize dependencies and start the worker', async () => {
    require('../index.js');

    // Validate that dependencies were initialized correctly
    assert(queueInstance.calledOnce);
    assert(psiClientInstance.calledOnce);
    assert(githubClientInstance.calledOnce);
    assert(contentClientInstance.calledOnce);

    // Validate that the worker was started
    assert(workerInstance.start.calledOnce);
  });

  it('should stop the worker on SIGINT', async () => {
    require('../index.js');

    process.emit('SIGINT'); // Emitting SIGINT

    assert(workerInstance.stop.calledOnce);
  });

  it('should stop the worker on SIGTERM', async () => {
    require('../index.js');

    process.emit('SIGTERM'); // Emitting SIGTERM

    assert(workerInstance.stop.calledOnce);
  });
});
