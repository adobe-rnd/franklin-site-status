const sinon = require('sinon');
const assert = require('assert');
const { extractDomainFromInput } = require('../utils/slackUtils.js');

describe('slackUtils.js', () => {
  it('extractDomainFromInput without path', async () => {
    const expected = 'adobe.com';

    assert.strictEqual(extractDomainFromInput('get site adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site adobe.com/', false), expected + '/');
    assert.strictEqual(extractDomainFromInput('get site http://adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://www.adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://www.adobe.com/', false), expected + '/');
  });

  it('extractDomainFromInput with path', async () => {
    const expected = 'adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('add site http://adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://www.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://www.adobe.com/some/path/w1th_numb3rs/', false), expected + '/');
  });

  it('extractDomainFromInput with subdomain and path', async () => {
    const expected = 'business.adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('get site http://business.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://business.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://business.adobe.com/some/path/w1th_numb3rs/', false), expected  + '/');
  });

  it('extractDomainFromInput domain only', async () => {
    const expected = 'business.adobe.com';

    assert.strictEqual(extractDomainFromInput('get site http://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('get site https://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('add site https://business.adobe.com/some/path/w1th_numb3rs/'), expected);
  });
});
