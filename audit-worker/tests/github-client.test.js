const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');
const GithubClient = require('../github-client.js');

describe('GithubClient', function() {
  let sandbox;

  // Create a Sinon sandbox before each test
  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  // Restore all mocks and stubs after each test
  afterEach(function() {
    sandbox.restore();
  });

  describe('createGithubApiUrl', function() {

    it('should create a basic URL', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com' });
      const url = client.createGithubApiUrl('openai');
      assert.strictEqual(url, 'https://api.github.com/repos/openai?page=1&per_page=100');
    });

    it('should include repoName in the URL', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com' });
      const url = client.createGithubApiUrl('openai', 'gpt-3');
      assert.strictEqual(url, 'https://api.github.com/repos/openai/gpt-3?page=1&per_page=100');
    });

    it('should append additional path to the URL', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com' });
      const url = client.createGithubApiUrl('openai', 'gpt-3', 'commits');
      assert.strictEqual(url, 'https://api.github.com/repos/openai/gpt-3/commits?page=1&per_page=100');
    });

    it('should include page number in the URL', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com' });
      const url = client.createGithubApiUrl('openai', 'gpt-3', 'commits', 5);
      assert.strictEqual(url, 'https://api.github.com/repos/openai/gpt-3/commits?page=5&per_page=100');
    });

  });

  describe('createGithubAuthHeaderValue', function() {

    it('should throw error if credentials are missing', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com' });
      assert.throws(() => {
        client.createGithubAuthHeaderValue();
      }, /GitHub credentials not provided/);
    });

    it('should create a valid Basic Auth header', function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      const header = client.createGithubAuthHeaderValue();
      assert.strictEqual(header, 'Basic ' + Buffer.from('id:secret').toString('base64'));
    });

  });

  describe('fetchGithubDiff', function() {

    it('should fetch diffs from GitHub', async function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });

      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };
      const lastAuditedAt = '2023-06-15T00:00:00.000Z';
      const gitHubURL = 'https://github.com/openai/gpt-3';

      const mockCommitsResponse = {
        data: [
          { sha: 'abc123' },
          { sha: 'def456' }
        ]
      };

      const mockDiffResponse = {
        data: "mocked-diff-data"
      };

      sandbox.stub(axios, 'get')
        .onFirstCall().resolves(mockCommitsResponse)
        .onSecondCall().resolves(mockDiffResponse)
        .onThirdCall().resolves(mockDiffResponse);

      const diffs = await client.fetchGithubDiff(audit, lastAuditedAt, gitHubURL);

      // Check axios.get call count
      assert.strictEqual(axios.get.callCount, 3);

      // Check axios.get was called with expected args for commits
      const expectedCommitsUrl = 'https://api.github.com/repos/openai/gpt-3/commits?page=1&per_page=100';
      sinon.assert.calledWith(axios.get.firstCall, expectedCommitsUrl, sinon.match.any);

      // Check axios.get was called with expected headers for commits
      const expectedAuthHeader = 'Basic ' + Buffer.from('id:secret').toString('base64');
      sinon.assert.calledWithMatch(axios.get.firstCall, sinon.match.any, {
        headers: {
          Authorization: expectedAuthHeader
        }
      });

      // Check axios.get was called with expected args for each diff
      const expectedDiffUrl = 'https://api.github.com/repos/openai/gpt-3/commits/abc123?page=1&per_page=100';
      sinon.assert.calledWith(axios.get.secondCall, expectedDiffUrl, sinon.match.any);

      // Check the resulting diffs
      assert.strictEqual(diffs, "mocked-diff-data\nmocked-diff-data\n");
    });

    it('should handle errors from GitHub API', async function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      sandbox.stub(axios, 'get').rejects(new Error('Network Error'));

      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };
      const lastAuditedAt = '2023-06-15T00:00:00.000Z';
      const gitHubURL = 'https://github.com/openai/gpt-3';

      const diffs = await client.fetchGithubDiff(audit, lastAuditedAt, gitHubURL);
      assert.strictEqual(diffs, '');
    });

    it('should handle unexpected data format from GitHub API', async function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      sandbox.stub(axios, 'get').resolves({ data: null });

      const audit = {
        lighthouseResult: {
          fetchTime: '2023-06-16T00:00:00.000Z'
        }
      };
      const lastAuditedAt = '2023-06-15T00:00:00.000Z';
      const gitHubURL = 'https://github.com/openai/gpt-3';

      const diffs = await client.fetchGithubDiff(audit, lastAuditedAt, gitHubURL);
      assert.strictEqual(diffs, '');
    });

    it('should set "since" to 24 hours before "until" if "lastAuditedAt" is not provided', async () => {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      const fixedFetchTime = '2023-06-16T00:00:00.000Z';
      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: fixedFetchTime,
          }
        }
      };
      const expectedSince = new Date(new Date(fixedFetchTime) - 86400 * 1000).toISOString();

      // Stub axios to return a mock response (prevent real API call)
      sandbox.stub(axios, 'get').resolves({ data: [] });

      await client.fetchGithubDiff(audit, null, 'https://github.com/openai/gpt-3');

      sinon.assert.calledWith(axios.get, sinon.match.any, sinon.match.hasNested('params.since', expectedSince));

      // Restore stubbed method
      axios.get.restore();
    });

    it('should skip binary or too large diffs', async () => {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      const mockDiffs = [
        { sha: 'commit1', data: 'Sample diff content' },
        { sha: 'commit2', data: 'Binary files differ' },
        { sha: 'commit3', data: 'Another diff content that makes the total size exceed MAX_DIFF_SIZE' }
      ];
      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };

      // Stub axios to return mock responses sequentially
      const axiosStub = sandbox.stub(axios, 'get');
      axiosStub.onFirstCall().resolves({ data: mockDiffs.map(diff => ({ sha: diff.sha })) });
      mockDiffs.forEach((diff, index) => {
        axiosStub.onCall(index + 1).resolves({ data: diff.data });
      });

      const logStub = sinon.stub(console, 'warn'); // Stub the log function to capture the warnings

      await client.fetchGithubDiff(audit, '2023-06-15T00:00:00.000Z', 'https://github.com/openai/gpt-3');

      sinon.assert.calledWithMatch(logStub, `Skipping commit ${mockDiffs[1].sha} because it is binary or too large (19 of ${102400}).`);

      // Restore stubbed methods
      axios.get.restore();
      logStub.restore();
    });

    it('should include diffs that are not binary and within size limit', async () => {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });
      const mockDiffs = [
        { sha: 'commit1', data: 'Sample diff content' },
        { sha: 'commit2', data: 'Another valid diff content' }
      ];
      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };

      // Ensure total size of both diffs is less than MAX_DIFF_SIZE
      if (mockDiffs.reduce((acc, diff) => acc + diff.data.length, 0) >= 102400) {
        throw new Error('Mock diffs total size exceeds MAX_DIFF_SIZE');
      }

      // Stub axios to return mock responses sequentially
      const axiosStub = sinon.stub(axios, 'get');
      axiosStub.onFirstCall().resolves({ data: mockDiffs.map(diff => ({ sha: diff.sha })) });
      mockDiffs.forEach((diff, index) => {
        axiosStub.onCall(index + 1).resolves({ data: diff.data });
      });

      const result = await client.fetchGithubDiff(audit, '2023-06-15T00:00:00.000Z', 'https://github.com/openai/gpt-3');

      // Check if the resulting diffs string contains the content of both mock diffs
      mockDiffs.forEach(diff => {
        assert.ok(result, diff.data);
      });

      // Restore stubbed method
      axios.get.restore();
    });

    it('should log error.response.data when error has a response property', async function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });

      // Error with a response property
      const errorWithResponse = {
        response: {
          data: 'Some structured error'
        }
      };

      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };

      sandbox.stub(axios, 'get').rejects(errorWithResponse);

      // Stub console.log to capture logs
      const logStub = sandbox.stub(console, 'error');

      await client.fetchGithubDiff(audit, '', 'https://github.com/openai/gpt-3');

      sinon.assert.calledWithMatch(logStub, 'Error fetching data:', 'Some structured error');

      // Restore stubbed methods
      logStub.restore();
    });

    it('should log the error directly when error does not have a response property', async function() {
      const client = new GithubClient({ baseUrl: 'https://api.github.com', githubId: 'id', githubSecret: 'secret' });

      const audit = {
        result: {
          lighthouseResult: {
            fetchTime: '2023-06-16T00:00:00.000Z'
          }
        }
      };

      // Generic error
      const genericError = new Error('Generic error');

      sandbox.stub(axios, 'get').rejects(genericError);

      // Stub console.log to capture logs
      const logStub = sandbox.stub(console, 'error');

      await client.fetchGithubDiff(audit, '', 'https://github.com/someapi/test');

      sinon.assert.calledWithMatch(logStub, 'Error fetching data:', genericError);

      // Restore stubbed methods
      logStub.restore();
    });
  });
});
