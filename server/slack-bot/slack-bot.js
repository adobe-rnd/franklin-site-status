const { App, ExpressReceiver } = require('@slack/bolt');

const getCachedSitesWithAudits = require('../cache');
const commands = require('./commands.js');

const BOT_MENTION_REGEX = /^<@[^>]+>\s+/;

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

/*receiver.router.post('/events', (req, res) => {
  const { challenge } = req.body;

  if (challenge) {
    res.set('Content-Type', 'text/plain');
    res.send(challenge);
  } else {
    res.status(200).end();
  }
});*/

const bot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

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
    console.error(error);
  }
});

bot.action('get_sites', async ({ body, ack, say }) => {
  await ack();

  let sites = await getCachedSitesWithAudits();

  let message = 'Franklin Sites:\n';
  sites.forEach(site => {
    message += `- ${site}\n`;
  });

  // Send the list of Franklin sites in the channel
  await say(message);
});

bot.action('get_site_by_domain', async ({ body, ack, say }) => {
  await ack();

  // Perform your API call here to get the site status
  const domain = body.actions[0].value;

  await say(`The status of ${domain} is ...`);
});

// Export the receiver's router so it can be used in your Express app
module.exports = receiver.router;
