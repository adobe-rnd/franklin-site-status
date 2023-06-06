const { getLastWord } = require('./formatUtils.js');
const { URL } = require('url');

const SLACK_URL_FORMAT_REGEX = /<([^|>]+)(?:\|[^>]+)?>/;

/**
 * Extracts the domain from the input message. If the input follows a specific Slack URL format, it extracts the
 * domain from the URL. If not, it assumes the input is the domain. If no input is provided, it returns null.
 *
 * @param {string} message - The input message.
 * @param domainOnly - If true, only the domain is returned. If false, the entire input is returned.
 * @returns {string|null} The domain extracted from the input message or null.
 */
function extractDomainFromInput(message, domainOnly = true) {
  const input = getLastWord(message);

  if (!input) {
    return null;
  }

  const linkedFormMatch = input.match(SLACK_URL_FORMAT_REGEX);

  if (linkedFormMatch) {
    const url = new URL(linkedFormMatch[1]);
    return domainOnly ? url.hostname : url.href;
  } else {
    return input.trim();
  }
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
