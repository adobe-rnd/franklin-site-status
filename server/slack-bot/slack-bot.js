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

bot.event('app_mention', async ({ context, event, client, say }) => {
  const thread_ts = event.thread_ts? event.thread_ts : event.event_ts;
  try {
    const message = event.text.replace(BOT_MENTION_REGEX, '').trim();
    for (const command of commands) {
      if (command.accepts(message)) {
        await command.execute(event, client, message, thread_ts,  say, commands);
        return;
      }
    }

    await commands.find(cmd => cmd.phrases.includes('help')).execute(event, client, message, thread_ts,  say, commands);

  } catch (error) {
    await postErrorMessage(say, thread_ts, error);
  }
});

module.exports = receiver.router;
