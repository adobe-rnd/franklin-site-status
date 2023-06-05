const express = require('express');
const apiRoutes = require('./routes/api-routes');
const { connectToDb } = require('./db');
const errorHandler = require('./middlewares/error-handler.js');
const slackBotRouter = require('./slack-bot/slack-bot');

const app = express();
app.use(errorHandler);
app.use('/api', apiRoutes);
app.use(slackBotRouter);

/*app.get('/admin', verifyAPIKey(process.env.ADMIN_API_KEY), (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});*/

connectToDb()
  .then(() => {
    const server = app.listen(8000, () => {
      console.log('Server is running on port 8000');
    });

    // Ensure that we close the database connection when the server is stopped
    process.on('SIGINT', () => {
      server.close(async () => {
        console.log('Server stopped');
        try {
          await disconnectFromDb();
          console.log('Database connection closed');
          process.exit(0);
        } catch (err) {
          console.error('Failed to close database connection', err);
          process.exit(1);
        }
      });
    });
  })
  .catch((err) => {
    console.error('Failed to connect to DB', err);
  });
