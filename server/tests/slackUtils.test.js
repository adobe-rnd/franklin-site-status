const sinon = require('sinon');
const assert = require('assert');
const { extractDomainFromInput } = require('../utils/slackUtils.js');

describe('slackUtils.js', () => {
  it('extractDomainFromInput without path', async () => {
    const expected = 'adobe.com';

    assert.strictEqual(extractDomainFromInput('get site adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <adobe.com|www.adobe.com>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site adobe.com/', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <adobe.com/>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site http://adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <http://adobe.com|www.adobe.com>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://adobe.com|www.adobe.com>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://www.adobe.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://www.adobe.com|www.adobe.com>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://www.adobe.com/', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://www.adobe.com/>', false), expected);
  });

  it('extractDomainFromInput with path', async () => {
    const expected = 'adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('add site http://adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site <http://adobe.com/some/path/w1th_numb3rs|adobe.com/some/path/w1th_numb3rs>', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site <https://adobe.com/some/path/w1th_numb3rs|adobe.com/some/path/w1th_numb3rs>', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://www.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('add site <https://www.adobe.com/some/path/w1th_numb3rs|www.adobe.com/some/path/w1th_numb3rs>', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://www.adobe.com/some/path/w1th_numb3rs/', false), expected + '/');
    assert.strictEqual(extractDomainFromInput('add site <https://www.adobe.com/some/path/w1th_numb3rs/>', false), expected + '/');
  });

  it('extractDomainFromInput with subdomain and path', async () => {
    const expected = 'business.adobe.com/some/path/w1th_numb3rs';

    assert.strictEqual(extractDomainFromInput('get site http://business.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <http://business.adobe.com/some/path/w1th_numb3rs|business.adobe.com/some/path/w1th_numb3rs>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://business.adobe.com/some/path/w1th_numb3rs', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://business.adobe.com/some/path/w1th_numb3rs|business.adobe.com/some/path/w1th_numb3rs>', false), expected);
    assert.strictEqual(extractDomainFromInput('add site https://business.adobe.com/some/path/w1th_numb3rs/', false), expected + '/');
    assert.strictEqual(extractDomainFromInput('add site <https://business.adobe.com/some/path/w1th_numb3rs/>', false), expected + '/');
  });

  it('extractDomainFromInput with subdomain, path and extension', async () => {
    const expected = 'personal.nedbank.co.za/borrow/personal-loans.html';

    assert.strictEqual(extractDomainFromInput('get site personal.nedbank.co.za/borrow/personal-loans.html', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <personal.nedbank.co.za/borrow/personal-loans.html|personal.nedbank.co.za/borrow/personal-loans.html>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.html', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.html|personal.nedbank.co.za/borrow/personal-loans.html>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.html/', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.html/>', false), expected);
  });

  it('extractDomainFromInput with subdomain, path, selector and extension', async () => {
    const expected = 'personal.nedbank.co.za/borrow/personal-loans.plain.html';

    assert.strictEqual(extractDomainFromInput('get site personal.nedbank.co.za/borrow/personal-loans.plain.html', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <personal.nedbank.co.za/borrow/personal-loans.plain.html|personal.nedbank.co.za/borrow/personal-loans.plain.html>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.plain.html', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.plain.html|personal.nedbank.co.za/borrow/personal-loans.plain.html>', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.plain.html/', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.plain.html/>', false), expected);
  });

  it('extractDomainFromInput domain only', async () => {
    const expected = 'business.adobe.com';

    assert.strictEqual(extractDomainFromInput('get site http://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('get site <http://business.adobe.com/some/path/w1th_numb3rs|business.adobe.com/some/path/w1th_numb3rs>'), expected);
    assert.strictEqual(extractDomainFromInput('get site https://business.adobe.com/some/path/w1th_numb3rs'), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://business.adobe.com/some/path/w1th_numb3rs|business.adobe.com/some/path/w1th_numb3rs>'), expected);
    assert.strictEqual(extractDomainFromInput('add site https://business.adobe.com/some/path/w1th_numb3rs/'), expected);
    assert.strictEqual(extractDomainFromInput('add site <https://business.adobe.com/some/path/w1th_numb3rs/>'), expected);
  });

  it('extractDomainFromInput with trailing tokens', async () => {
    const expected = 'personal.nedbank.co.za/borrow/personal-loans.plain.html';

    assert.strictEqual(extractDomainFromInput('get site personal.nedbank.co.za/borrow/personal-loans.plain.html test', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <personal.nedbank.co.za/borrow/personal-loans.plain.html|personal.nedbank.co.za/borrow/personal-loans.plain.html> test', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.plain.html www.acme.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.plain.html|personal.nedbank.co.za/borrow/personal-loans.plain.html> www.acme.com', false), expected);
    assert.strictEqual(extractDomainFromInput('get site https://personal.nedbank.co.za/borrow/personal-loans.plain.html/ extra acme.com/', false), expected);
    assert.strictEqual(extractDomainFromInput('get site <https://personal.nedbank.co.za/borrow/personal-loans.plain.html/> extra acme.com/ <acme.com/> <http://acme.com|acme.com>', false), expected);
  });
});
