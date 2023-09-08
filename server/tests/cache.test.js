const sinon = require('sinon');
const assert = require('assert');
const db = require('../db.js');

describe('cache.js', () => {
  let getSitesWithAuditsStub;
  let getCachedSitesWithAudits;

  beforeEach(() => {
    // Clear the cache for the cache.js module
    delete require.cache[require.resolve('../cache.js')];

    // Stub the DB method
    getSitesWithAuditsStub = sinon.stub(db, 'getSitesWithAudits').resolves(['site1', 'site2']);

    // Now require the cache module
    getCachedSitesWithAudits = require('../cache.js').getCachedSitesWithAudits;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should fetch sites from DB if cache is empty', async () => {
    const sites = await getCachedSitesWithAudits();
    assert.deepEqual(sites, ['site1', 'site2']);
    assert(getSitesWithAuditsStub.calledOnce);
  });

  it('should use cached sites if cache is valid', async () => {
    await getCachedSitesWithAudits(); // This call will populate the cache
    assert(getSitesWithAuditsStub.calledOnce); // The DB method should be called only once

    const sites = await getCachedSitesWithAudits(); // This call should use the cache
    assert.deepEqual(sites, ['site1', 'site2']);
    assert(getSitesWithAuditsStub.calledOnce); // The DB method should still have been called only once
  });

  it('should refresh the cache if it is older than five minutes', async () => {
    await getCachedSitesWithAudits(); // This call will populate the cache
    assert(getSitesWithAuditsStub.calledOnce); // The DB method should be called only once

    // Simulate a delay of more than five minutes
    const delay = 6 * 60 * 1000; // 6 minutes in milliseconds
    const clock = sinon.useFakeTimers(Date.now() + delay);

    await getCachedSitesWithAudits(); // This call should refresh the cache
    assert(getSitesWithAuditsStub.calledTwice); // The DB method should now be called twice

    clock.restore();
  });
});
