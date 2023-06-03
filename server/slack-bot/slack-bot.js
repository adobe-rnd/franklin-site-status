const { App, ExpressReceiver } = require('@slack/bolt');

const getCachedSitesWithAudits = require('../cache');


// Initialize your custom receiver
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

receiver.router.post('/events', (req, res) => {
  const { challenge } = req.body;

  if (challenge) {
    res.set('Content-Type', 'text/plain');
    res.send(challenge);
  } else {
    res.status(200).end();
  }
});

// Initialize your Bolt app with the custom receiver
const bot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

// Add your Slack bot routes here
bot.event('app_mention', async ({ context, event }) => {
  try {
    await bot.client.chat.postMessage({
      token: context.botToken,
      channel: event.channel,
      text: "Button and input field here",
      attachments: [
        {
          blocks: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Get Franklin Sites",
                emoji: true,
              },
              value: "click_me_123",
              action_id: "get_sites",
            },
            {
              type: "input",
              element: {
                type: "plain_text_input",
                action_id: "get_site_by_domain",
              },
              label: {
                type: "plain_text",
                text: "Domain",
                emoji: true,
              },
            },
          ],
        },
      ],
    });
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
