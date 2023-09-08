const sinon = require('sinon');
const assert = require('assert');
const BaseCommand = require('../slack-bot/commands/base-command.js');

describe('slackUtils.js', () => {
  it('extractDomainFromInput without path', async () => {
    const getSiteCommand = BaseCommand({
      phrases: ['get site', 'get domain'],
    });

    const getSitesCommand = BaseCommand({
      phrases: ['get sites'],
    });

    const getSiteMessages = ['get site', 'get site blah', 'get site blah blah']
    const getSitesMessages = ['get sites', 'get sites blah', 'get sites blah blah'];

    for (const siteMessage of getSiteMessages) {
      assert.strictEqual(getSiteCommand.accepts(siteMessage), true);
      assert.strictEqual(getSitesCommand.accepts(siteMessage), false);
    }

    for (const sitesMessage of getSitesMessages) {
      assert.strictEqual(getSiteCommand.accepts(sitesMessage), false);
      assert.strictEqual(getSitesCommand.accepts(sitesMessage), true);
    }
  });
});
