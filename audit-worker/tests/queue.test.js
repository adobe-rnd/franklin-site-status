const assert = require('assert');
const sinon = require('sinon');
const amqp = require('amqplib');
const Queue = require('../queue.js'); // Adjust this path based on your directory structure

describe('Queue', function () {
  let queue;
  const config = {
    username: 'test',
    password: 'test',
    host: 'localhost',
    port: '5672'
  };

  beforeEach(function () {
    queue = Queue(config);
    queue.setRetryDelay(10);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('connect', function () {
    it('should connect to the broker', async function () {
      const connectStub = sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({
          prefetch: sinon.stub().resolves(),
          on: sinon.stub()
        }),
        on: sinon.stub()
      });

      await queue.connect();

      sinon.assert.calledOnce(connectStub);
    });

    it('should handle connection errors and retry', async function () {
      const error = new Error('Connection error');

      let callCount = 0;
      sinon.stub(amqp, 'connect').callsFake(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(error);
        } else {
          return Promise.resolve({
            createChannel: sinon.stub().resolves({ prefetch: sinon.stub().resolves(), on: sinon.stub() }),
            on: sinon.stub()
          });
        }
      });

      await queue.connect();
      assert.strictEqual(callCount, 4, `Expected amqp.connect to have been called 4 times, but was called ${callCount} times`);
    });

    it('should handle connection close and reconnect', async function () {
      const connectStub = sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({
          prefetch: sinon.stub().resolves(),
          on: sinon.stub()
        }),
        on: sinon.stub().callsFake((event, handler) => {
          if (event === 'close') {
            setTimeout(handler, 50); // simulate a close event asynchronously
          }
        })
      });

      await queue.connect();
      await new Promise(resolve => setTimeout(resolve, 100)); // wait to ensure any asynchronous handlers are called
      sinon.assert.calledTwice(connectStub); // once initially, once for reconnect
    });

    it('should log errors from the message broker', async function () {
      const logStub = sinon.stub(console, 'error');
      const error = new Error('Broker error');

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves({
          prefetch: sinon.stub().resolves(),
          on: sinon.stub()
        }),
        on: sinon.stub().callsFake((event, handler) => {
          if (event === 'error') {
            handler(error); // simulate an error event
          }
        })
      });

      await queue.connect();
      sinon.assert.calledWith(logStub, 'Error from message broker: ', error);
    });
  });

  describe('consumeMessages', function () {
    it('should warn if channel is not available', async function () {
      const logStub = sinon.stub(console, 'error');
      await queue.consumeMessages('test-queue', () => {
      });

      sinon.assert.calledWith(logStub, 'Channel is not available. Make sure to connect to broker first.');
    });

    it('should skip processing for null messages', async function () {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback(null);
        }),
        prefetch: sinon.stub().resolves(),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel),
        on: sinon.stub().resolves(),
      });

      const handlerSpy = sinon.spy();

      await queue.connect();
      await queue.consumeMessages('test-queue', handlerSpy);

      sinon.assert.notCalled(handlerSpy);
    });

    it('should process messages from the queue', async function () {
      const assertQueueStub = sinon.stub().resolves();
      const consumeStub = sinon.stub();

      const fakeChannel = {
        assertQueue: assertQueueStub,
        consume: consumeStub,
        prefetch: sinon.stub().resolves(),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel),
        on: sinon.stub().resolves(),
      });

      await queue.connect();
      await queue.consumeMessages('test-queue', () => {
      });

      sinon.assert.calledWith(assertQueueStub, 'test-queue', { durable: true });
    });

    it('should log the received valid JSON message', async function () {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback({ content: Buffer.from('{"message": "Hello"}') });
        }),
        prefetch: sinon.stub().resolves(),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel),
        on: sinon.stub().resolves(),
      });

      const logStub = sinon.stub(console, 'debug');
      const handlerSpy = sinon.spy();

      await queue.connect();
      await queue.consumeMessages('test-queue', handlerSpy);

      sinon.assert.calledWith(logStub, 'Received message: {"message": "Hello"}');
    });

    it('should handle errors in the consumeMessages method gracefully', async function () {
      const error = new Error('Test error');
      const fakeChannel = {
        assertQueue: sinon.stub().rejects(error),
        prefetch: sinon.stub().resolves(),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel),
        on: sinon.stub().resolves(),
      });

      const logStub = sinon.stub(console, 'error');

      await queue.connect();
      await queue.consumeMessages('test-queue', () => {
      });

      sinon.assert.calledWith(logStub, 'Error:', 'Test error');
    });

    it('should handle JSON parse errors gracefully', async function () {
      const fakeChannel = {
        assertQueue: sinon.stub().resolves(),
        consume: sinon.stub().callsFake((_, callback) => {
          callback({ content: Buffer.from('Invalid JSON') });
        }),
        prefetch: sinon.stub().resolves(),
      };

      sinon.stub(amqp, 'connect').resolves({
        createChannel: sinon.stub().resolves(fakeChannel),
        on: sinon.stub().resolves(),
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
