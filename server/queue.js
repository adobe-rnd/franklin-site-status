const amqp = require('amqplib');

/** Maximum number of reconnection attempts */
const MAX_RETRIES = 5;
let RETRY_DELAY = 1000; // default delay between retries

function setRetryDelay(delay) {
  RETRY_DELAY = delay;
}

let connection;

/**
 * Attempts to get the current RabbitMQ connection.
 * If not connected, it will attempt to reconnect.
 * @returns {Promise<object>} The RabbitMQ connection object.
 * @throws Will throw an error if unable to connect after maximum retries.
 */
async function getConnection() {
  if (!connection) {
    console.warn('Connection is not established. Attempting to reconnect...');
    await connectToMessageBroker();
    if (!connection) {
      throw new Error('Not connected to message broker!');
    }
  }
  return connection;
}

/**
 * Connects to the RabbitMQ message broker.
 * It will attempt to reconnect with exponential backoff if the connection fails, up to MAX_RETRIES.
 */
async function connectToMessageBroker() {
  let retryCount = 0;
  while (retryCount < MAX_RETRIES) {
    try {
      const username = process.env.RABBITMQ_USERNAME;
      const password = process.env.RABBITMQ_PASSWORD;
      const host = process.env.RABBITMQ_SERVICE_SERVICE_HOST;
      const port = process.env.RABBITMQ_SERVICE_SERVICE_PORT;
      const connectionURL = `amqp://${username}:${password}@${host}:${port}`;

      connection = await amqp.connect(connectionURL);
      console.log("RabbitMQ connection established");

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
 * Disconnects from the RabbitMQ message broker.
 */
async function disconnectFromMessageBroker() {
  try {
    if (!connection) {
      console.warn('Warning: Not connected to message broker');
      return;
    }
    await connection.close();
    console.info('Disconnected from message broker.');
  } catch (error) {
    console.error('Error disconnecting from message broker: ', error);
  }
}

/**
 * Handles the connection close event.
 * Attempts to reconnect if the number of retries is less than MAX_RETRIES.
 */
async function handleConnectionClose() {
  console.warn('Connection to message broker closed. Reconnecting...');
  await connectToMessageBroker();
}

/**
 * Logs errors from the message broker.
 * @param {Error} error - The error object from the message broker.
 */
function handleError(error) {
  console.error('Error from message broker: ', error);
}

/**
 * Sends messages to the specified queue.
 * @param {string} queue - The name of the queue.
 * @param {Array} messages - The messages to be sent.
 * @returns {Promise<void>}
 */
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

/**
 * Queues a single site to audit.
 * @param {object} site - The site to be audited.
 * @returns {Promise<void>}
 */
async function queueSiteToAudit(site) {
  return sendMessages(process.env.AUDIT_TASKS_QUEUE_NAME, [site]);
}

/**
 * Queues multiple sites to audit.
 * @param {Array} sites - The sites to be audited.
 * @returns {Promise<void>}
 */
async function queueSitesToAudit(sites) {
  return sendMessages(process.env.AUDIT_TASKS_QUEUE_NAME, sites);
}

module.exports = {
  connectToMessageBroker,
  disconnectFromMessageBroker,
  queueSiteToAudit,
  queueSitesToAudit,
  setRetryDelay,
  getConnection,
};
