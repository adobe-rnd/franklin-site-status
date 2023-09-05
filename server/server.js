const express = require('express');
const apiRoutes = require('./routes/api-routes');
const errorHandler = require('./middlewares/error-handler.js');
const slackBotRouter = require('./slack-bot/slack-bot');
const { connectToDb, disconnectFromDb } = require('./db');
const { connectToMessageBroker, disconnectFromMessageBroker } = require('./queue');

const app = express();
app.use(errorHandler);
app.use('/api', apiRoutes);
app.use(slackBotRouter);

/*app.get('/admin', verifyAPIKey(process.env.ADMIN_API_KEY), (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});*/


Promise.all([connectToDb(), connectToMessageBroker()])
  .then(() => {
    const server = app.listen(8000, () => {
      console.log('Server is running on port 8000');
    });

    // Ensure that we close the database connection when the server is stopped
    process.on('SIGINT', () => {
      server.close(async () => {
        console.log('Server stopped');
        try {
          await Promise.all([disconnectFromDb(), disconnectFromMessageBroker()]);
          console.log('Database and message broker connections established');
          process.exit(0);
        } catch (err) {
          console.error('Failed to close connections', err);
          process.exit(1);
        }
      });
    });
  })
  .catch((err) => {
    console.error('Failed to establish connections', err);
  });
