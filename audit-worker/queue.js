const amqp = require('amqplib');

const MAX_RETRIES = 5; // Maximum number of reconnection attempts
let RETRY_DELAY = 1000; // default delay between retries

function setRetryDelay(delay) {
  RETRY_DELAY = delay;
}

function Queue(config) {
  const { username, password, host, port } = config;

  let connection = null;
  let channel = null;

  /**
   * Connects to the RabbitMQ message broker and creates a channel.
   * It will attempt to reconnect with exponential backoff if the connection fails, up to MAX_RETRIES.
   */
  async function connect() {
    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
      try {
        const connectionURL = `amqp://${username}:${password}@${host}:${port}`;
        connection = await amqp.connect(connectionURL);
        channel = await connection.createChannel();
        channel.prefetch(1);

        console.log('Connected to broker');

        connection.on('close', handleConnectionClose);
        connection.on('error', handleError);

        retryCount = 0;
        break;
      } catch (error) {
        console.error('Error connecting to message broker:', error.message);
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * RETRY_DELAY;
          console.log(`Retrying in ${delay} ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    if (retryCount === MAX_RETRIES) {
      console.error('Max retries reached. Giving up...');
    }
  }

  /**
   * Handles the connection close event.
   * Attempts to reconnect if the number of retries is less than MAX_RETRIES.
   */
  async function handleConnectionClose() {
    console.warn('Connection to broker closed. Reconnecting...');
    await connect();
  }

  /**
   * Logs errors from the message broker.
   * @param {Error} error - The error object from the message broker.
   */
  function handleError(error) {
    console.error('Error from message broker: ', error);
  }

  /**
   * Closes the connection and the channel to the broker.
   */
  async function close() {
    try {
      if (channel) {
        await channel.close();
      }
      if (connection) {
        await connection.close();
      }
      console.log('Connection to broker closed');
    } catch (error) {
      console.error('Error closing broker connection:', error);
    }
  }

  /**
   * Consumes messages from the specified queue and processes them using the provided handler.
   * @param {string} queue - The name of the queue.
   * @param {Function} handler - The handler function to process the messages.
   */
  async function consumeMessages(queue, handler) {
    if (!channel) {
      console.error('Channel is not available. Make sure to connect to broker first.');
      return;
    }

    try {
      await channel.assertQueue(queue, { durable: true });
      console.log(`Listening to the queue: ${queue}`);

      channel.consume(queue, async (message) => {
        if (message === null) return;

        const content = message.content.toString();
        console.debug(`Received message: ${content}`);

        try {
          const json = JSON.parse(content);
          await handler(json);

          // acknowledge the message to remove it from the queue
          // manual ack for all now, we can play with auto ack/nack + redelivery settings later on
          channel.ack(message);
        } catch (error) {
          console.error('Error processing message:', error.message);
          channel.nack(message, false, false);  // The last argument being `false` tells RabbitMQ not to requeue
        }
      });

    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  return {
    connect,
    close,
    consumeMessages,
    setRetryDelay,
  };
}

module.exports = Queue;
