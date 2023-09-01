const sinon = require('sinon');
const assert = require('assert');
const util = require('../util.js');

describe('util.js', () => {
  let consoleInfoStub, consoleErrorStub, consoleWarnStub, consoleLogStub;

  beforeEach(() => {
    // Stub the console methods
    consoleInfoStub = sinon.stub(console, 'info');
    consoleErrorStub = sinon.stub(console, 'error');
    consoleWarnStub = sinon.stub(console, 'warn');
    consoleLogStub = sinon.stub(console, 'log');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should log with console.info for level "info"', () => {
    util.log('info', 'Test message', 'arg1', 'arg2');
    assert(consoleInfoStub.calledOnce);
    assert(consoleInfoStub.calledWithMatch(/INFO: Test message/)); // Verifying the message structure
  });

  it('should log with console.error for level "error"', () => {
    util.log('error', 'Test error message', 'arg1', 'arg2');
    assert(consoleErrorStub.calledOnce);
    assert(consoleErrorStub.calledWithMatch(/ERROR: Test error message/)); // Verifying the message structure
  });

  it('should log with console.warn for level "warn"', () => {
    util.log('warn', 'Test warn message', 'arg1', 'arg2');
    assert(consoleWarnStub.calledOnce);
    assert(consoleWarnStub.calledWithMatch(/WARN: Test warn message/)); // Verifying the message structure
  });

  it('should log with console.log for unknown levels', () => {
    util.log('unknown', 'Test unknown message', 'arg1', 'arg2');
    assert(consoleLogStub.calledOnce);
    assert(!consoleLogStub.calledWithMatch(/WARN: Test unknown message/)); // It shouldn't have the "WARN" prefix
    assert(!consoleLogStub.calledWithMatch(/ERROR: Test unknown message/)); // It shouldn't have the "ERROR" prefix
    assert(!consoleLogStub.calledWithMatch(/INFO: Test unknown message/)); // It shouldn't have the "INFO" prefix
    assert(consoleLogStub.calledWithMatch(/Test unknown message/)); // It should just log the message directly
  });
});
