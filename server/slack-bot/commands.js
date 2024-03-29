const axios = require('axios');

module.exports = (bot) => {
  return [
    require('./commands/add-repo.js')(bot, axios),
    require('./commands/add-site.js')(bot, axios),
    require('./commands/get-site.js')(bot),
    require('./commands/get-sites.js')(bot),
    require('./commands/martech-impact.js')(bot),
    require('./commands/run-audit.js')(bot),
    require('./commands/set-live-status.js')(bot),
    require('./commands/help.js')(bot),
  ];
};
