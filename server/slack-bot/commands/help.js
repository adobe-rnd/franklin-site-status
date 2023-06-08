const BaseCommand = require('./base-command.js');

/**
 * The phrases that trigger the HelpCommand.
 * @type {string[]}
 */
const PHRASES = ['help', 'what can you do'];

/**
 * The bot's introduction message.
 * @type {string}
 */
const INTRO_MESSAGE = `
Greetings, I am SpaceCat, an emerging Slack bot. Within my limited abilities, I can aid you in unraveling the mysteries of orbital mechanics for Franklin Sites. As a fledgling bot, my skills are raw and undeveloped. Embrace the darkness with me as we venture into the abyss of space. Ad astra pro terra!\n\n*Here are the commands I understand:*
`;

/**
 * Creates a HelpCommand instance.
 *
 * @param {Object} bot - The bot instance.
 * @returns {Object} The created HelpCommand instance.
 */
function HelpCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'help',
    name: "Help",
    description: 'Displays a help message',
    phrases: PHRASES,
  });

  /**
   * Executes the help command.
   * Sends a help message to the user.
   *
   * @param {Array} args - The arguments passed to the command.
   * @param {Function} say - The function to send a message to the user.
   * @param {Array} commands - The list of commands the bot can execute.
   * @returns {Promise<void>} A Promise that resolves when the command is executed.
   */
  const handleExecution = async (args, say, commands) => {
    let blocks = [{
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": INTRO_MESSAGE,
      },
    }];

    for (const command of commands) {
      blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${command.name}*\n${command.usage()}\n${command.description}\n\n`,
        },
      });
    }

    await say({ blocks });
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    handleExecution,
  };
}

module.exports = HelpCommand;
