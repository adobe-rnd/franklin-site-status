const sinon = require('sinon');
const assert = require('assert');
const { MongoClient } = require('mongodb');
const dbModule = require('../db.js');

describe('db.js', function () {
  // Shared stubs
  let connectStub, closeStub, mockedCollection, insertOneStub, findOneStub, updateOneStub, deleteOneStub;

  beforeEach(async () => {
    insertOneStub = sinon.stub().resolves();
    findOneStub = sinon.stub().resolves();
    updateOneStub = sinon.stub().resolves();
    deleteOneStub = sinon.stub().resolves();

    mockedCollection = {
      insertOne: insertOneStub,
      findOne: findOneStub,
      updateOne: updateOneStub,
      deleteOne: deleteOneStub,
      find: sinon.stub().returns({
        toArray: sinon.stub().resolves([]),
        projection: sinon.stub().returnsThis()
      }),
      aggregate: sinon.stub().returns({
        toArray: sinon.stub().resolves([]),
      })
    };

    sinon.stub(dbModule, 'getDb').returns({
      collection: sinon.stub().returns(mockedCollection)
    });

    connectStub = sinon.stub(MongoClient.prototype, 'connect').resolves();
    closeStub = sinon.stub(MongoClient.prototype, 'close').resolves();

    sinon.stub(MongoClient.prototype, 'db').returns({
      collection: sinon.stub().returns(mockedCollection)
    });


    await dbModule.connectToDb();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getNestedValue', function () {
    it('should return the nested value when the path exists', function () {
      const obj = {
        a: {
          b: {
            c: 42
          }
        }
      };
      assert.strictEqual(dbModule.getNestedValue(obj, 'a.b.c'), 42);
    });

    it('should return -Infinity when the path does not exist', function () {
      const obj = {};
      assert.strictEqual(dbModule.getNestedValue(obj, 'a.b.c'), -Infinity);
    });
  });

  describe('sortSites', function () {
    it('should place sites with an error in lastAudit or without lastAudit at the end', function () {
      const sites = [
        { lastAudit: { isError: false, auditResult: { categories: { performance: { score: 50 } } } } },
        { lastAudit: { isError: true } },
        { lastAudit: { isError: false, auditResult: { categories: { performance: { score: 40 } } } } }
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.strictEqual(sorted[2].lastAudit.isError, true);
    });

    it('should sort sites without errors by their scores in ascending order', function () {
      const sites = [
        {
          lastAudit: {
            isError: false,
            auditResult: { categories: { performance: { score: 50 }, seo: { score: 90 } } }
          }
        },
        {
          lastAudit: {
            isError: false,
            auditResult: { categories: { performance: { score: 80 }, seo: { score: 95 } } }
          }
        },
        {
          lastAudit: {
            isError: false,
            auditResult: { categories: { performance: { score: 70 }, seo: { score: 85 } } }
          }
        }
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.strictEqual(sorted[0].lastAudit.auditResult.categories.performance.score, 50);
      assert.strictEqual(sorted[1].lastAudit.auditResult.categories.performance.score, 70);
      assert.strictEqual(sorted[2].lastAudit.auditResult.categories.performance.score, 80);
    });

    it('should place sites without lastAudit at the end', function () {
      const sites = [
        { lastAudit: { isError: false, auditResult: { categories: { performance: { score: 50 } } } } },
        {},
        { lastAudit: { isError: false, auditResult: { categories: { performance: { score: 70 } } } } }
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.deepStrictEqual(sorted[2], {});
    });

    it('should handle -Infinity conditions in sortSites', function () {
      const sites = [
        { lastAudit: { auditResult: { categories: {} } } },
        { lastAudit: { auditResult: { categories: { performance: { score: 50 } } } } },
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.strictEqual(sorted[1].lastAudit.auditResult.categories.performance.score, 50);
    });

    it('should handle else branch of value comparison in sortSites', function () {
      const sites = [
        { lastAudit: { auditResult: { categories: { performance: { score: 50 } } } } },
        { lastAudit: { auditResult: { categories: { performance: { score: 50 }, seo: { score: 100 } } } } },
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.strictEqual(sorted[1].lastAudit.auditResult.categories.seo.score, 100);
    });

    it('should handle equal values in sortSites', function () {
      const sites = [
        { lastAudit: { auditResult: { categories: { performance: { score: 50 } } } } },
        { lastAudit: { auditResult: { categories: { performance: { score: 50 } } } } },
      ];
      const sorted = dbModule.sortSites(sites, dbModule.SITES_SORT_CONFIG);
      assert.deepStrictEqual(sorted, sites);
    });
  });

  describe('MongoDB Operations', function () {
    it('should connect to the database', async () => {
      assert(connectStub.calledOnce);
    });

    it('should disconnect from the database', async () => {
      await dbModule.disconnectFromDb();
      assert(closeStub.calledOnce);
    });

    it('should handle catch in connectToDb', async () => {
      sinon.restore();
      sinon.stub(MongoClient.prototype, 'connect').rejects(new Error('Connection error'));
      try {
        await dbModule.connectToDb();
        assert.fail('Expected connect to throw but it did not.');
      } catch (err) {
        assert.strictEqual(err.message, 'Connection error');
      }
    });

/*    it('should handle catch in disconnectFromDb', async () => {
      sinon.restore();
      sinon.stub(MongoClient.prototype, 'close').rejects(new Error('Disconnection error'));
      try {
        await dbModule.disconnectFromDb();
        assert.fail('Expected disconnect to throw but it did not.');
      } catch (err) {
        assert.strictEqual(err.message, 'Disconnection error');
      }
    });*/

    it('should create a site', async () => {
      await dbModule.createSite({});
      assert(insertOneStub.calledOnce);
    });

    it('should update a site', async () => {
      await dbModule.updateSite('some-id', {});
      assert(updateOneStub.calledOnce);
    });

    it('should retrieve sites to audit', async () => {
      await dbModule.getSitesToAudit();
      assert(mockedCollection.find.calledOnce);
    });

    it('should retrieve sites with audits', async () => {
      await dbModule.getSitesWithAudits();
      assert(mockedCollection.aggregate.calledOnce);
    });

    it('should retrieve a site by its domain', async () => {
      await dbModule.getSiteByDomain("example.com");
      assert(mockedCollection.aggregate.calledOnce);
    });
  });
});
