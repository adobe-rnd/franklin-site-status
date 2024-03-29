const axios = require('axios');
const jsdiff = require('diff');
const { log } = require('./util.js');

const NOT_FOUND_STATUS = 404;

/**
 * Represents a utility for calculating content differences from Markdown files fetched via HTTP.
 */
function ContentClient() {

  /**
   * Creates a diff patch between two strings. Helper function for testability.
   * @param url - The URL of the Markdown file.
   * @param oldContent - The old Markdown content.
   * @param newContent - The new Markdown content.
   * @returns {string} The diff patch between the old and new content.
   */
  function createDiffPatch(url, oldContent, newContent) {
    return jsdiff.createPatch(url, oldContent, newContent);
  }

  /**
   * Asynchronously fetches the Markdown content from a specified audit URL and
   * calculates the difference between this content and the Markdown content from
   * the latest audit, if any exists.
   *
   * @async
   * @function
   * @param {string} domain - The domain of the audited site.
   * @param {Object} latestAudit - The latest audit, if present, contains the latest audit's Markdown content.
   * @param {string} contentUrl - The URL of the content page used in the audit.
   * @returns {Promise<Object|null>} A promise that resolves to an object containing the Markdown content and its diff with the latest audit, or `null` if there was an error or the final URL was not found. The object has the following shape:
   *   {
   *     diff: string|null,      // The diff between the latest audit's Markdown content and the current Markdown content in patch format, or null if contents are identical or latest audit doesn't exist.
   *     content: string         // The Markdown content fetched from the final URL.
   *   }
   * @throws Will throw an error if there's a network issue or some other error while downloading the Markdown content.
   */
  async function fetchMarkdownDiff(domain, latestAudit = {}, contentUrl) {
    let markdownDiff = null;
    let markdownContent = null;

    if (!contentUrl) {
      log('error', 'Final URL not found in the audit object.');
      return null;
    }

    // Download the markdown content
    const markdownUrl = contentUrl.endsWith('/') ? `${contentUrl}index.md` : `${contentUrl}.md`;

    try {
      const response = await axios.get(markdownUrl);
      markdownContent = response.data;

      log('info', `Downloaded Markdown content from ${markdownUrl} for site ${domain}`);

      const oldContent = latestAudit?.markdownContent || '';

      if (oldContent !== markdownContent) {
        markdownDiff = createDiffPatch(markdownUrl, oldContent, markdownContent);
        log('info', `Found Markdown diff ${markdownDiff.length} characters long for site ${domain}`);
      } else {
        log('info', `No Markdown diff found for site ${domain}`);
      }
    } catch (err) {
      if (err.response && err.response.status === NOT_FOUND_STATUS) {
        log('info', `Markdown content not found for site ${domain}`);
      } else {
        log('error', `Error while downloading Markdown content for site ${domain}:`, err);
      }
    }

    return {
      markdownDiff,
      markdownContent,
    }
  }

  return {
    fetchMarkdownDiff,
  };
}

module.exports = ContentClient;
