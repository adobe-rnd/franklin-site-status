const assert = require('assert');
const sinon = require('sinon');
const amqp = require('amqplib');
const Queue = require('../queue.js'); // Adjust this path based on your directory structure

describe('Queue', function() {
  let queue;
  const config = {
    username: 'test',
    password: 'test',
    host: 'localhost',
    port: '5672'
  };

  beforeEach(function() {
    queue = Queue(config);
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('connect', function() {
    it('should connect to the broker', async function() {
      const connectStub = sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({})
      });

      await queue.connect();

      sinon.assert.calledOnce(connectStub);
    });

    it('should handle connection errors', async function() {
      const error = new Error('Connection error');
      sinon.stub(amqp, 'connect').rejects(error);

      try {
        await queue.connect();
        assert.fail('Expected connect to throw but it did not.');
      } catch (e) {
        assert.strictEqual(e, error);
      }
    });
  });

  describe('close', function() {
    it('should close the connection and channel', async function() {
      const closeConnectionStub = sinon.stub().resolves();
      const closeChannelStub = sinon.stub().resolves();

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({ close: closeChannelStub }),
        close: closeConnectionStub
      });

      await queue.connect();  // This will "create" the mock connection and channel
      await queue.close();

      sinon.assert.calledOnce(closeChannelStub);
      sinon.assert.calledOnce(closeConnectionStub);
    });

    it('should handle closing errors gracefully', async function() {
      queue = Queue({
        ...config,
        connection: { close: sinon.stub().throws(new Error('Close error')) },
        channel: { close: sinon.stub().resolves() }
      });

      await queue.close(); // should not throw any error
    });

    it('should log error if there\'s an issue closing the channel', async function() {
      const channelCloseError = new Error('Channel close error');
      const channelCloseStub = sinon.stub().throws(channelCloseError);
      const logStub = sinon.stub(console, 'error');

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({ close: channelCloseStub }),
        close: sinon.stub().resolves() // Simulating successful connection close.
      });

      await queue.connect();  // This will "create" the mock connection and channel.
      await queue.close();

      sinon.assert.calledWith(logStub, 'Error closing broker connection:', channelCloseError);
    });

    it('should log error if there\'s an issue closing the broker connection', async function() {
      const connectionCloseError = new Error('Connection close error');
      const connectionCloseStub = sinon.stub().throws(connectionCloseError);
      const logStub = sinon.stub(console, 'error');

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({ close: sinon.stub().resolves() }), // Simulating successful channel close.
        close: connectionCloseStub
      });

      await queue.connect();  // This will "create" the mock connection and channel.
      await queue.close();

      sinon.assert.calledWith(logStub, 'Error closing broker connection:', connectionCloseError);
    });
  });

  describe('consumeMessages', function() {
    it('should warn if channel is not available', async function() {
      const logStub = sinon.stub(console, 'error');
      await queue.consumeMessages('test-queue', () => {});

      sinon.assert.calledWith(logStub, 'Channel is not available. Make sure to connect to broker first.');
    });

    it('should skip processing for null messages', async function() {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback(null);
        })
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel)
      });

      const handlerSpy = sinon.spy();

      await queue.connect();
      await queue.consumeMessages('test-queue', handlerSpy);

      sinon.assert.notCalled(handlerSpy);
    });

    it('should process messages from the queue', async function() {
      const assertQueueStub = sinon.stub().resolves();
      const consumeStub = sinon.stub();

      const fakeChannel = {
        assertQueue: assertQueueStub,
        consume: consumeStub
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel)
      });

      await queue.connect();
      await queue.consumeMessages('test-queue', () => {});

      sinon.assert.calledWith(assertQueueStub, 'test-queue', { durable: true });
    });

    it('should log the received valid JSON message', async function() {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback({ content: Buffer.from('{"message": "Hello"}') });
        })
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel)
      });

      const logStub = sinon.stub(console, 'debug');
      const handlerSpy = sinon.spy();

      await queue.connect();
      await queue.consumeMessages('test-queue', handlerSpy);

      sinon.assert.calledWith(logStub, 'Received message: {"message": "Hello"}');
    });

    it('should handle errors in the consumeMessages method gracefully', async function() {
      const error = new Error('Test error');
      const fakeChannel = {
        assertQueue: sinon.stub().rejects(error),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel)
      });

      const logStub = sinon.stub(console, 'error');

      await queue.connect();
      await queue.consumeMessages('test-queue', () => {});

      sinon.assert.calledWith(logStub, 'Error:', 'Test error');
    });

    it('should handle JSON parse errors gracefully', async function() {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback({ content: Buffer.from('Invalid JSON') });
        })
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel)
      });

      const handlerSpy = sinon.spy();
      const logStub = sinon.stub(console, 'error');

      await queue.connect();
      await queue.consumeMessages('test-queue', handlerSpy);

      sinon.assert.notCalled(handlerSpy);
      sinon.assert.calledWithMatch(logStub, 'Error processing message:', 'Unexpected token \'I\', "Invalid JSON" is not valid JSON');
    });
  });
});
