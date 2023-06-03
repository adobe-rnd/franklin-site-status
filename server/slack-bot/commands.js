const getSite = require('./commands/get-site.js');
const getSites = require('./commands/get-sites.js');
const help = require('./commands/help.js');

const commands = [
  getSite,
  getSites,
  help,
];

module.exports = commands;
