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
 * Formats the score as a whole number percentage.
 *
 * @param {number} score - The score to be formatted.
 * @returns {string} The formatted percentage string.
 */
const formatScore = (score) => {
  const percentage = Math.round(score * PERCENT_MULTIPLIER);
  return `${percentage}%`.padStart(3, " ");
};

module.exports = {
  formatDate,
  formatScore,
  getLastWord,
};
