const sinon = require('sinon');
const assert = require('assert');
const { extractDomainFromInput } = require('../utils/slackUtils.js');

describe('slackUtils.js', () => {
  it('extractDomainFromInput without path', async () => {
    const expected = 'adobe.com';

    assert.strictEqual(extractDomainFromInput('adobe.com'), expected);
    assert.strictEqual(extractDomainFromInput('adobe.com/'), expected);
    assert.strictEqual(extractDomainFromInput('http://adobe.com'), expected);
    assert.strictEqual(extractDomainFromInput('https://adobe.com'), expected);
    assert.strictEqual(extractDomainFromInput('https://www.adobe.com'), expected);
    assert.strictEqual(extractDomainFromInput('https://www.adobe.com/'), expected);
  });

  it('extractDomainFromInput with path', async () => {
    const expected = 'adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('http://adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('https://adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('https://www.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('https://www.adobe.com/some/path/w1th_numb3rs/'), expected);
  });

  it('extractDomainFromInput with subdomain and path', async () => {
    const expected = 'business.adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('http://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('https://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('https://business.adobe.com/some/path/w1th_numb3rs/'), expected);
  });
});
