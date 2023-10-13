const { getLastWord } = require('./formatUtils.js');
const { URL } = require('url');

const SLACK_URL_FORMAT_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})([/\w.-]*\/?)/;
const DEFAULT_TEXT = 'Block text';

/**
 * Extracts the domain from the input string. If the input follows a specific Slack URL format, it extracts the
 * domain from the URL. If not, it assumes the input is the domain. If no input is provided, it returns null.
 *
 * @param {string} input - The input string.
 * @param domainOnly - If true, only the domain is returned. If false, the entire input is returned.
 * @returns {string|null} The domain extracted from the input message or null.
 */
function extractDomainFromInput(input, domainOnly = true) {
  const tokens = input.split(' ');

  for (const token of tokens) {
    if ((match = SLACK_URL_FORMAT_REGEX.exec(token)) !== null) {
      // see https://api.slack.com/reference/surfaces/formatting#links-in-retrieved-messages
      const processedToken = token.charAt(0) === '<' && token.charAt(token.length - 1) === '>'
        ? token.slice(1, token.length - 1).split('|').at(0)
        : token;
      const urlToken = processedToken.includes('://') ? processedToken : `http://${processedToken}`;
      const url = new URL(urlToken);
      const { hostname, pathname } = url;
      // we do not keep the www
      const finalHostname = hostname.replace(/^www\./, '');
      // we remove trailing slashes for paths only when an extension is provided 
      const parts = pathname.split('.');
      const finalPathname = parts.length > 1 && parts[parts.length - 1].endsWith('/')
        ? pathname.replace(/\/+$/, '')
        : pathname;
      return !domainOnly && finalPathname && finalPathname !== '/'
        ? `${finalHostname}${finalPathname}`
        : finalHostname;
    }
  }
  return null;
}

/**
 * Sends an error message to the user and logs the error.
 *
 * @param {Function} say - The function to send a message to the user.
 * @param {string} thread_ts - The thread_ts to send the message to.
 * @param {Error} error - The error to log and send a message about.
 */
const postErrorMessage = async (say, thread_ts, error) => {
  if (thread_ts !== undefined) {
    await say( { text: `:nuclear-warning: Oops! Something went wrong: ${error.message}`, thread_ts });
  } else {
    await say( { text: `:nuclear-warning: Oops! Something went wrong: ${error.message}` });
  }
  console.error(error);
};

/**
 * Sends a message to the user with the given text.
 * @param {Function} say - The function to send a message to the user.
 * @param {string} thread_ts - The thread_ts to send the message to.
 * @param {string} text - The text to send.
 */
const sendTextMessage = async (say, thread_ts, text) => {
  if(thread_ts !== undefined) {
    await say({ text, thread_ts });
  } else {
    await say({ text });
  }
}

/**
 * Sends a message to the user with the given text.
 * @param {Object} client - The client to send a message to the user.
 * @param {string} channel - The channel to send the message to.
 * @param {string} userId - The user to send the message to.
 * @param {string} text - The text to send.
 */
const sendDirectMessage = async (client, channel, userId, text) => {
  const result = await client.chat.postEphemeral({
    channel: channel,
    user: userId,
    text: text,
  });
  console.log(result);
}

/**
 * Sends a message with blocks to the user.
 *
 * @param {Function} say - The function to send a message to the user.
 * @param {string} thread_ts - The thread_ts to send the message to.
 * @param {Object[]} textSections - The sections of the message.
 * @param {Object[]} [additionalBlocks=[]] - Additional blocks to send in the message.
 */
const sendMessageBlocks = async (say, thread_ts, textSections, additionalBlocks = []) => {
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
  if (thread_ts !== undefined) {
    await say({ text: DEFAULT_TEXT, blocks, thread_ts });
  } else {
    await say({ text: DEFAULT_TEXT, blocks });
  }
};

module.exports = {
  extractDomainFromInput,
  postErrorMessage,
  sendTextMessage,
  sendMessageBlocks,
  sendDirectMessage
};
