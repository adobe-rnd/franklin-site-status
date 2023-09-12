const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');

const ContentClient = require('../content-client.js');

describe('ContentClient', function () {
  let contentClient;

  beforeEach(function () {
    contentClient = ContentClient();
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('fetchMarkdownDiff', function () {
    it('should return null if finalUrl is not present in the audit object', async function () {
      const audit = { lighthouseResult: {} };

      const result = await contentClient.fetchMarkdownDiff(null, audit);

      assert.strictEqual(result, null);
    });

    it('should append "index.md" to the markdown URL if it ends with "/"', async () => {
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com/'
        }
      };

      const axiosStub = sinon.stub(axios, 'get').resolves({ data: 'Sample Markdown content' });

      await contentClient.fetchMarkdownDiff(null, audit);

      assert(axiosStub.calledWith('http://example.com/index.md'), 'Expected axios.get to be called with the correct URL');
    });

    it('should fetch Markdown content successfully', async function () {
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com'
        }
      };

      const markdownContentStub = "Sample Markdown content";
      const expectedMarkdownDiff = "Index: http://example.com.md\n===================================================================\n--- http://example.com.md\n+++ http://example.com.md\n@@ -0,0 +1,1 @@\n+Sample Markdown content\n\\ No newline at end of file\n"
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(null, audit);

      assert.strictEqual(result.markdownContent, markdownContentStub);
      assert.strictEqual(result.markdownDiff, expectedMarkdownDiff);
    });

    it('should find a difference between the latest audit and the fetched Markdown content', async function () {
      const latestAudit = {
        markdownContent: "Original Markdown content"
      };
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com'
        }
      };

      const markdownContentStub = "Changed Markdown content";
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(latestAudit, audit);

      assert.strictEqual(result.markdownContent, markdownContentStub);
      assert.strictEqual(
        result.markdownDiff,
        'Index: http://example.com.md\n' +
        '===================================================================\n' +
        '--- http://example.com.md\n' +
        '+++ http://example.com.md\n' +
        '@@ -1,1 +1,1 @@\n' +
        '-Original Markdown content\n' +
        '\\ No newline at end of file\n' +
        '+Changed Markdown content\n' +
        '\\ No newline at end of file\n',
      );
    });

    it('should not find a difference if latest audit and fetched Markdown content are identical', async function () {
      const latestAudit = {
        markdownContent: "Sample Markdown content"
      };
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com'
        }
      };

      const markdownContentStub = "Sample Markdown content";
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(latestAudit, audit);

      assert.strictEqual(result.markdownContent, markdownContentStub);
      assert.strictEqual(result.markdownDiff, null);
    });

    it('should handle 404 Not Found response gracefully', async function () {
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com'
        }
      };

      const error = new Error('Not Found');
      error.response = { status: 404 };
      sinon.stub(axios, 'get').rejects(error);

      const result = await contentClient.fetchMarkdownDiff(null, audit);

      assert.strictEqual(result.markdownContent, null);
      assert.strictEqual(result.markdownDiff, null);
    });

    it('should handle network errors gracefully', async function () {
      const audit = {
        lighthouseResult: {
          finalUrl: 'http://example.com'
        }
      };

      const error = new Error('Network Error');
      sinon.stub(axios, 'get').rejects(error);

      const logStub = sinon.stub(console, 'error');

      await contentClient.fetchMarkdownDiff(null, audit);

      sinon.assert.calledWithMatch(logStub, 'Error while downloading Markdown content:', error);
    });
  });
});
