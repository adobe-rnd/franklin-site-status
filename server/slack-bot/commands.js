module.exports = (bot) => {
  return [
    require('./commands/get-site.js')(bot),
    require('./commands/get-sites.js')(bot),
    require('./commands/help.js')(bot),
  ];
};
