const { getLastWord } = require('./formatUtils.js');
const { URL } = require('url');

const SLACK_URL_FORMAT_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})([/\w.-]*\/?)/;

/**
 * Extracts the domain from the input string. If the input follows a specific Slack URL format, it extracts the
 * domain from the URL. If not, it assumes the input is the domain. If no input is provided, it returns null.
 *
 * @param {string} input - The input string.
 * @param domainOnly - If true, only the domain is returned. If false, the entire input is returned.
 * @returns {string|null} The domain extracted from the input message or null.
 */
function extractDomainFromInput(input, domainOnly = true) {
  const tokens = input.split(" ");
  let result = null;

  for (const token of tokens) {
    if ((match = SLACK_URL_FORMAT_REGEX.exec(token)) !== null) {
      const urlToken = token.includes("://") ? token : "http://" + token;
      const url = new URL(urlToken);
      const { hostname, pathname } = url;
      // we do not keep the www
      const finalHostname = hostname.split('www.').pop();
      // we remove trailing slashes for paths only when an extension is provided 
      const [...parts] = pathname.split('.');
      const finalPathname = parts.length > 1 && parts.pop().endsWith('/')
        ? pathname.replace(/\/+$/, '')
        : pathname;
      result = !domainOnly && finalPathname && finalPathname !== '/'
        ? finalHostname + finalPathname
        : finalHostname;
        break;
    }
  }
  return result;
}

/**
 * Sends an error message to the user and logs the error.
 *
 * @param {Function} say - The function to send a message to the user.
 * @param {Error} error - The error to log and send a message about.
 */
const postErrorMessage = async (say, error) => {
  await say(`:nuclear-warning: Oops! Something went wrong: ${error.message}`);
  console.error(error);
};

/**
 * Sends a message with blocks to the user.
 *
 * @param {Function} say - The function to send a message to the user.
 * @param {Object[]} textSections - The sections of the message.
 * @param {Object[]} [additionalBlocks=[]] - Additional blocks to send in the message.
 */
const sendMessageBlocks = async (say, textSections, additionalBlocks = []) => {
  let blocks = textSections.map(section => {
    let block = {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": section.text
      }
    };

    if (section.accessory) {
      block.accessory = section.accessory;
    }

    return block;
  });

  blocks.push(...additionalBlocks);

  await say({ blocks });
};

module.exports = {
  extractDomainFromInput,
  postErrorMessage,
  sendMessageBlocks,
};
