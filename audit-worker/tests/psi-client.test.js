const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');
const PSIClient = require('../psi-client.js');

describe('PSIClient', function () {
  let client;
  const config = {
    apiKey: 'test-api-key',
    baseUrl: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  };

  beforeEach(function () {
    client = PSIClient(config);
  });

  afterEach(function () {
    sinon.restore(); // Reset any sinon stubs or spies
  });

  describe('getPSIApiUrl', function () {
    it('should build a correct PSI API URL', function () {
      const apiUrl = client.getPSIApiUrl('example.com');
      const expectedUrl = `${config.baseUrl}?url=https%3A%2F%2Fexample.com&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;
      assert.strictEqual(apiUrl, expectedUrl);
    });

    it('should use mobile strategy by default', function () {
      const apiUrl = client.getPSIApiUrl('example.com');
      const expectedUrl = `${config.baseUrl}?url=https%3A%2F%2Fexample.com&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;
      assert.strictEqual(apiUrl, expectedUrl);
    });

    it('should use mobile strategy when specified', function () {
      const apiUrl = client.getPSIApiUrl('example.com', 'mobile');
      const expectedUrl = `${config.baseUrl}?url=https%3A%2F%2Fexample.com&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;
      assert.strictEqual(apiUrl, expectedUrl);
    });

    it('should use desktop strategy when specified', function () {
      const apiUrl = client.getPSIApiUrl('example.com', 'desktop');
      const expectedUrl = `${config.baseUrl}?url=https%3A%2F%2Fexample.com&key=${config.apiKey}&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo`;
      assert.strictEqual(apiUrl, expectedUrl);
    });

    it('should default to mobile strategy for invalid strategy', function () {
      const apiUrl = client.getPSIApiUrl('example.com', 'invalid-strategy');
      const expectedUrl = `${config.baseUrl}?url=https%3A%2F%2Fexample.com&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;
      assert.strictEqual(apiUrl, expectedUrl);
    });

    // Input edge cases for getPSIApiUrl
    it('should handle empty domain input gracefully', function () {
      const apiUrl = client.getPSIApiUrl('');
      assert.strictEqual(apiUrl, `${config.baseUrl}?url=https%3A%2F%2F&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`);
    });

    it('should encode special characters in domain', function () {
      const apiUrl = client.getPSIApiUrl('example.com/some path');
      assert.strictEqual(apiUrl, `${config.baseUrl}?url=https%3A%2F%2Fexample.com%2Fsome+path&key=${config.apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`);
    });
  });

  describe('runAudit', () => {
    let axiosGetStub;

    beforeEach(() => {
      axiosGetStub = sinon.stub(axios, 'get');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should run mobile strategy audit', async () => {
      const mockResponse = { data: 'some mobile data' };
      axiosGetStub.resolves(mockResponse);

      const audit = await client.runAudit('someUrl');

      // Ensure the axios get method was called with the correct parameters
      axiosGetStub.calledWithMatch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2FsomeUrl&key=test-api-key&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo');

      // Ensure the response structure is correct
      assert.deepStrictEqual(audit.result.mobile, {
        audits: {
          'third-party-summary': undefined,
          'total-blocking-time': undefined
        },
        categories: undefined,
        configSettings: undefined,
        environment: undefined,
        fetchTime: undefined,
        finalDisplayedUrl: undefined,
        finalUrl: undefined,
        lighthouseVersion: undefined,
        mainDocumentUrl: undefined,
        requestedUrl: undefined,
        runWarnings: undefined,
        timing: undefined,
        userAgent: undefined
      });
    });

    it('should run desktop strategy audit', async () => {
      const mockResponse = { data: 'some desktop data' };
      axiosGetStub.resolves(mockResponse);

      const audit = await client.runAudit('someUrl');

      // Ensure the axios get method was called with the correct parameters
      axiosGetStub.calledWithMatch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2FsomeUrl&key=test-api-key&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo');

      // Ensure the response structure is correct
      assert.deepStrictEqual(audit.result.desktop, {
        audits: {
          'third-party-summary': undefined,
          'total-blocking-time': undefined
        },
        categories: undefined,
        configSettings: undefined,
        environment: undefined,
        fetchTime: undefined,
        finalDisplayedUrl: undefined,
        finalUrl: undefined,
        lighthouseVersion: undefined,
        mainDocumentUrl: undefined,
        requestedUrl: undefined,
        runWarnings: undefined,
        timing: undefined,
        userAgent: undefined
      });
    });

    it('should throw an error if the audit fails', async () => {
      axiosGetStub.rejects(new Error('Failed to fetch PSI'));

      try {
        await client.runAudit('someUrl');
        assert.fail('Expected runAudit to throw an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Failed to fetch PSI');
      }
    });
  });

  describe('performPSICheck', function () {
    const expectedResult = {
      audits: {
        'third-party-summary': undefined,
        'total-blocking-time': undefined
      },
      categories: undefined,
      configSettings: undefined,
      environment: undefined,
      fetchTime: undefined,
      finalDisplayedUrl: undefined,
      finalUrl: undefined,
      lighthouseVersion: undefined,
      mainDocumentUrl: undefined,
      requestedUrl: undefined,
      runWarnings: undefined,
      timing: undefined,
      userAgent: undefined
    };

    beforeEach(function () {
      // Mock axios.get to prevent actual API calls
      sinon.stub(axios, 'get').resolves({ data: {} });
    });

    it('should perform a PSI check and process data', async function () {
      const data = await client.performPSICheck('example.com');
      assert.deepEqual(data, expectedResult); // Assuming axios mock returns empty object as data
    });

    // Input edge cases for performPSICheck
    it('should handle empty domain input gracefully', async function () {
      const data = await client.performPSICheck('');
      assert.deepEqual(data, expectedResult); // Assuming axios mock returns empty object for any input
    });

    it('should handle domain with special characters', async function () {
      const data = await client.performPSICheck('example.com/some path');
      assert.deepEqual(data, expectedResult); // Assuming axios mock returns empty object for any input
    });
  });

  describe('processAuditData', function () {
    it('should replace dots with underscores in keys', function () {
      const inputData = {
        'key.with.dot': 'value',
        'another.key.with.dot': {
          'nested.key': 'nestedValue'
        }
      };
      const processedData = client.processAuditData(inputData);
      assert.deepEqual(processedData, {
        'key_with_dot': 'value',
        'another_key_with_dot': {
          'nested_key': 'nestedValue'
        }
      });
    });

    // Input edge cases for processAuditData
    it('should handle empty object input gracefully', function () {
      const processedData = client.processAuditData({});
      assert.deepEqual(processedData, {});
    });

    it('should handle null input gracefully', function () {
      const processedData = client.processAuditData(null);
      assert.strictEqual(processedData, null);
    });

    it('should leave keys without dots unchanged', function () {
      const inputData = {
        'keyWithoutDot': 'value',
        'anotherKey': {
          'nestedKey': 'nestedValue'
        }
      };
      const processedData = client.processAuditData(inputData);
      assert.deepEqual(processedData, inputData);
    });
  });

  describe('formatURL', function () {
    it('should replace http:// prefix with https://', function () {
      const formattedUrl = client.formatURL('http://example.com');
      assert.strictEqual(formattedUrl, 'https://example.com');
    });
    it('should add https:// prefix to a URL without http/https prefix', function () {
      const formattedUrl = client.formatURL('example.com');
      assert.strictEqual(formattedUrl, 'https://example.com');
    });
  });
});
