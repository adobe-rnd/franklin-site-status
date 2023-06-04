const BaseCommand = require('./base-command.js');

const PHRASES = ['help', 'what can you do'];

function HelpCommand(bot) {
  const baseCommand = BaseCommand({
    id: 'help',
    name: "Help",
    description: 'Displays a help message',
    phrases: PHRASES,
  });

  const execute = async (message, say, commands) => {
    let blocks = [{
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Greetings, I am SpaceCat, an emerging Slack bot. Within my limited abilities, I can aid you in unraveling the mysteries of orbital mechanics for Franklin Sites. As a fledgling bot, my skills are raw and undeveloped. Embrace the darkness with me as we venture into the abyss of space. Ad astra pro terra!\n\n*Here are the commands I understand:*"
      }
    }];

    for (const command of commands) {
      blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${command.name}*\n${command.usage()}\n${command.description}\n\n`
        }
      });
    }

    await say({ blocks });
  };

  baseCommand.init(bot);

  return {
    ...baseCommand,
    execute,
  };
}

module.exports = HelpCommand;
