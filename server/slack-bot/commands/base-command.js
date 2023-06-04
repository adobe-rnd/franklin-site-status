/**
 * Base command factory function.
 * Creates a base command object with specified options.
 *
 * @param {Object} options - The options for the command.
 * @param {string} options.id - The unique identifier of the command.
 * @param {string} options.description - The description of the command.
 * @param {string} options.name - The display name of the command.
 * @param {string} [options.usageText] - The usage instructions for the command.
 * @param {string[]} [options.phrases=[]] - The phrases that trigger the command.
 *
 * @returns {Object} The base command object.
 */
function BaseCommand({
                       id,
                       description,
                       name,
                       usageText,
                       phrases = [],
                     }) {
  /**
   * Determines if a message should be accepted by this command.
   *
   * @param {string} message - The incoming message.
   * @returns {boolean} true if the message includes one of the phrases, false otherwise.
   */
  const accepts = (message) => {
    return phrases.some(phrase => message.includes(phrase));
  };

  /**
   * Stub for the command's execution function.
   * Throws an error by default. This method should be overridden by a specific command.
   *
   * @throws {Error} Always thrown, since this method must be overridden.
   */
  const execute = () => {
    throw new Error(`Command '${id}' must implement the 'execute' method.`);
  };

  /**
   * Returns the usage instructions for the command.
   * If a usage property was provided, it returns that. Otherwise, it returns a string with all the command phrases.
   *
   * @returns {string} The usage instructions.
   */
  const usage = () => {
    if (usageText) {
      return `Usage: _${usageText}_`;
    }
    return `Usage: _${phrases.join(', ')}_`;
  };

  /**
   * No-op initialization function.
   * This is a placeholder for command-specific initialization code.
   * It should be overridden by a specific command if necessary.
   *
   * @param {Object} bot - The bot instance.
   */
  const init = (bot) => {
    // No-op by default. Override in specific command modules if needed.
  };

  return {
    id,
    description,
    name,
    phrases,
    accepts,
    execute,
    usage,
    init,
  };
}

module.exports = BaseCommand;
