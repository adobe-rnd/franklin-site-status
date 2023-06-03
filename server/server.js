const express = require('express');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api-routes');
const { connectToDb } = require('./db');
const errorHandler = require('./middlewares/error-handler.js');

const app = express();
app.use(bodyParser.json());
app.use(errorHandler);
app.use('/api', apiRoutes);

/*app.get('/admin', verifyAPIKey(process.env.ADMIN_API_KEY), (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});*/

connectToDb()
  .then(() => {
    app.listen(8000, () => {
      console.log('Server is running on port 8000');
    });
  })
  .catch((err) => {
    console.error('Failed to connect to DB', err);
  });
