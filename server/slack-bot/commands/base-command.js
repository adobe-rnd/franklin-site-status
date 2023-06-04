function BaseCommand({
                       id,
                       description,
                       name,
                       usage,
                       phrases,
                     }) {
  return {
    id,
    description,
    name,
    phrases,

    accepts: (message) => {
      return phrases.some(phrase => message.includes(phrase));
    },

    execute: () => {
      throw new Error(`Command '${id}' must implement the 'execute' method.`);
    },

    usage: () => {
      if (usage) {
        return `Usage: _${usage}_`;
      }
      return `Usage: _${(phrases || []).join(', ')}_`;
    },

    init: (bot) => {
      // This is a no-op by default. Override in specific command modules if needed.
    }
  };
}

module.exports = BaseCommand;
