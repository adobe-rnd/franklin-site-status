const sinon = require('sinon');
const assert = require('assert');
const db = require('../db.js');

describe('cache.js', () => {
  const mockSites = [
    {
      domain: "site1.com",
      lastAudit: {
        auditResults: {
          mobile: {
            categories: {
              performance: { score: 36 },
              seo: { score: 93 },
              accessibility: { score: 87 },
              bestPractices: { score: 100 }
            }
          }
        }
      }
    },
    {
      domain: "site2.com",
      lastAudit: {
        auditResults: {
          mobile: {
            categories: {
              performance: { score: 66 },
              seo: { score: 92 },
              accessibility: { score: 85 },
              bestPractices: { score: 95 }
            }
          }
        }
      }
    },
    {
      domain: "site3.com",
      lastAudit: {
        auditResults: {
          mobile: {
            categories: {
              performance: { score: 22 },
              seo: { score: 90 },
              accessibility: { score: 100 },
              bestPractices: { score: 100 }
            }
          }
        }
      }
    }
  ];

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

  it('should sort sites based on scores', async () => {
    getSitesWithAuditsStub.resolves(mockSites);

    const sites = await getCachedSitesWithAudits('mobile');

    assert(sites[0].domain === "site3.com");
    assert(sites[1].domain === "site1.com");
    assert(sites[2].domain === "site2.com");
  });

});
