const PERCENT_MULTIPLIER = 100;

/**
 * Extracts the last word from a sentence.
 *
 * @param {string} sentence - The sentence to extract the last word from.
 * @return {string} - The last word of the sentence.
 */
const getLastWord = (sentence) => {
  return sentence.trim().split(' ').pop();
}

/**
 * Formats an ISO date.
 *
 * @param {string} isoDate - The ISO date to format.
 * @return {string} - The formatted date.
 */
const formatDate = (isoDate) => {
  if (isoDate === null) {
    return "N/A";
  }

  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toISOString().replace("T", " ").slice(0, 19);
};

/**
 * Converts a score to a percentage and formats it.
 *
 * @param {number} score - The score to format.
 * @return {string} - The formatted score.
 */
const formatScore = (score) => {
  const percentage = score * PERCENT_MULTIPLIER;
  return `${percentage}%`.padStart(4, " ");
};

module.exports = {
  formatDate,
  formatScore,
  getLastWord,
};
