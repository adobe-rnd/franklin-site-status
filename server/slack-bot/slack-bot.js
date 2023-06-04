const { App, ExpressReceiver } = require('@slack/bolt');

const getCachedSitesWithAudits = require('../cache');

const BOT_MENTION_REGEX = /^<@[^>]+>\s+/;

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const bot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

const commands = require('./commands.js')(bot);

const postErrorMessage = async (say, error) => {
  await say(`:nuclear-warning: Oops! Something went wrong: ${error.message}`);
  console.error(error);
};

bot.event('app_mention', async ({ context, event, say }) => {
  try {
    const message = event.text.replace(BOT_MENTION_REGEX, '').trim();

    for (const command of commands) {
      if (command.accepts(message)) {
        await command.execute(message, say, commands);
        return;
      } else {
      }
    }

    await commands.find(cmd => cmd.phrases.includes('help')).execute(message, say, commands);

  } catch (error) {
    await postErrorMessage(say, error);
  }
});

module.exports = receiver.router;
