const jsdiff = require('diff');

function ContentClient() {
  /**
   * Asynchronously fetches the Markdown content from a specified audit URL and
   * calculates the difference between this content and the Markdown content from
   * the latest audit, if any exists.
   *
   * @async
   * @function
   * @param {Object} latestAudit - The latest audit, if present, contains the latest audit's Markdown content.
   * @param {Object} audit - The current audit object containing lighthouse result.
   * @param {Object} audit.lighthouseResult - The lighthouse result object.
   * @param {string} audit.lighthouseResult.finalUrl - The final URL where the Markdown content is located.
   * @returns {Promise<Object|null>} A promise that resolves to an object containing the Markdown content and its diff with the latest audit, or `null` if there was an error or the final URL was not found. The object has the following shape:
   *   {
   *     diff: string|null,      // The diff between the latest audit's Markdown content and the current Markdown content in patch format, or null if contents are identical or latest audit doesn't exist.
   *     content: string         // The Markdown content fetched from the final URL.
   *   }
   * @throws Will throw an error if there's a network issue or some other error while downloading the Markdown content.
   */
  async function fetchMarkdownDiff(latestAudit, audit) {
    const url = audit.lighthouseResult?.finalUrl;

    if (!url) {
      log('error', 'Final URL not found in the audit object.');
      return null;
    }

    // Download the markdown content
    const markdownUrl = url.endsWith('/') ? `${url}index.md` : `${url}.md`;

    try {
      const response = await axios.get(markdownUrl);
      const markdownContent = response.data;

      log('info', `Downloaded Markdown content from ${markdownUrl}`);

      // Only calculate the diff if content has changed and markdownContent exists
      if (latestAudit && latestAudit.markdownContent && latestAudit.markdownContent !== markdownContent) {
        const markdownDiff = jsdiff.createPatch(markdownUrl, latestAudit.markdownContent, markdownContent);
        log('info', `Found Markdown diff ${markdownDiff.length} characters long`);

        return {
          diff: markdownDiff,
          content: markdownContent,
        };
      }

      log('info', 'No Markdown diff found');

      return {
        diff: null,
        content: markdownContent,
      };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        log('info', 'Markdown content not found');
        return null;
      }

      log('error', 'Error while downloading Markdown content:', err);
      return null;
    }
  }

  return {
    fetchMarkdownDiff,
  };
}

module.exports = ContentClient;
