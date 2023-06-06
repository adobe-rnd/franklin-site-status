const axios = require('axios');

module.exports = (bot) => {
  return [
    require('./commands/add-repo.js')(bot, axios),
    require('./commands/get-site.js')(bot),
    require('./commands/get-sites.js')(bot),
    require('./commands/help.js')(bot),
  ];
};
