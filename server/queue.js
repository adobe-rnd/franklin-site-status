const amqp = require('amqplib');

let connection;

function getConnection() {
  if (!connection) {
    throw new Error('Not connected to message broker!');
  }
  return connection;
}

async function connectToMessageBroker() {
  try {
    const username = process.env.RABBITMQ_USERNAME;
    const password = process.env.RABBITMQ_PASSWORD;
    const host = process.env.RABBITMQ_SERVICE_SERVICE_HOST;
    const port = process.env.RABBITMQ_SERVICE_SERVICE_PORT;

    const connectionURL = `amqp://${username}:${password}@${host}:${port}`;
    connection = await amqp.connect(connectionURL);

    console.log("RabbitMQ connection established");
  } catch (error) {
    console.error('Error connecting to message broker:', error.message);
    throw error;
  }
}

async function disconnectFromMessageBroker() {
  try {
    if (!connection) {
      console.warn('Warning: Not connected to message broker');
      return;
    }
    connection.close();

    console.info('Disconnected from message broker.');
  } catch (error) {
    console.error('Error disconnecting from from message broker: ', error);
  }
}

async function sendMessages(queue, messages = []) {
  try {
    const channel = await getConnection().createChannel();
    await channel.assertQueue(queue, { durable: true });

    for (const message of messages) {
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    }

    console.debug(`${messages.length} messages sent successfully!`);

    await channel.close();
  } catch (error) {
    console.error('Error sending messages to broker:', error.message);
  }
}

async function queueSiteToAudit(site) {
  return sendMessages(process.env.AUDIT_TASKS_QUEUE_NAME, [site]);
}

async function queueSitesToAudit(sites) {
  return sendMessages(process.env.AUDIT_TASKS_QUEUE_NAME, sites);
}


module.exports = {
  connectToMessageBroker,
  disconnectFromMessageBroker,
  queueSiteToAudit,
  queueSitesToAudit,
};
