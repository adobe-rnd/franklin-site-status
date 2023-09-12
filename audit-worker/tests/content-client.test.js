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
    it('should return null if content URL is not given', async function () {
      const result = await contentClient.fetchMarkdownDiff(null, null);

      assert.strictEqual(result, null);
    });

    it('should append "index.md" to the markdown URL if it ends with "/"', async () => {
      const axiosStub = sinon.stub(axios, 'get').resolves({ data: 'Sample Markdown content' });

      await contentClient.fetchMarkdownDiff(null, 'http://example.com/');

      assert(axiosStub.calledWith('http://example.com/index.md'), 'Expected axios.get to be called with the correct URL');
    });

    it('should fetch Markdown content successfully', async function () {
      const markdownContentStub = "Sample Markdown content";
      const expectedMarkdownDiff = "Index: http://example.com.md\n===================================================================\n--- http://example.com.md\n+++ http://example.com.md\n@@ -0,0 +1,1 @@\n+Sample Markdown content\n\\ No newline at end of file\n"
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(null, 'http://example.com');

      assert.strictEqual(result.markdownContent, markdownContentStub);
      assert.strictEqual(result.markdownDiff, expectedMarkdownDiff);
    });

    it('should find a difference between the latest audit and the fetched Markdown content', async function () {
      const latestAudit = {
        markdownContent: "Original Markdown content"
      };

      const markdownContentStub = "Changed Markdown content";
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(latestAudit, 'http://example.com');

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

      const markdownContentStub = "Sample Markdown content";
      sinon.stub(axios, 'get').resolves({ data: markdownContentStub });

      const result = await contentClient.fetchMarkdownDiff(latestAudit, 'http://example.com');

      assert.strictEqual(result.markdownContent, markdownContentStub);
      assert.strictEqual(result.markdownDiff, null);
    });

    it('should handle 404 Not Found response gracefully', async function () {
      const error = new Error('Not Found');
      error.response = { status: 404 };
      sinon.stub(axios, 'get').rejects(error);

      const result = await contentClient.fetchMarkdownDiff(null, 'http://example.com');

      assert.strictEqual(result.markdownContent, null);
      assert.strictEqual(result.markdownDiff, null);
    });

    it('should handle network errors gracefully', async function () {
      const error = new Error('Network Error');
      sinon.stub(axios, 'get').rejects(error);

      const logStub = sinon.stub(console, 'error');

      await contentClient.fetchMarkdownDiff(null, 'http://example.com');

      sinon.assert.calledWithMatch(logStub, 'Error while downloading Markdown content:', error);
    });
  });
});
