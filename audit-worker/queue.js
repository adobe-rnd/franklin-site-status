const amqp = require('amqplib');

function Queue(config) {
  const { username, password, host, port } = config;

  let connection = null;
  let channel = null;

  async function connect() {
    try {
      const connectionURL = `amqp://${username}:${password}@${host}:${port}`;
      connection = await amqp.connect(connectionURL);
      channel = await connection.createChannel();
      channel.prefetch(1);
      console.log('Connected to broker');
    } catch (error) {
      console.error('Error connecting to broker:', error);
      throw error;
    }
  }

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
  };
}

module.exports = Queue;
