const { App, ExpressReceiver } = require('@slack/bolt');

const { postErrorMessage } = require('../utils/slackUtils.js');

const BOT_MENTION_REGEX = /^<@[^>]+>\s+/;

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const bot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

const commands = require('./commands.js')(bot);

bot.event('app_mention', async ({ context, event, say }) => {
  try {
    const message = event.text.replace(BOT_MENTION_REGEX, '').trim();
    const thread_ts = event.thread_ts? event.thread_ts : event.event_ts;
    for (const command of commands) {
      if (command.accepts(message)) {
        await command.execute(message, thread_ts,  say, commands);
        return;
      }
    }

    await commands.find(cmd => cmd.phrases.includes('help')).execute(message, thread_ts, say, commands);

  } catch (error) {
    await postErrorMessage(say, error);
  }
});

module.exports = receiver.router;
