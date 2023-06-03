const PERCENT_MULTIPLIER = 100;

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

const formatScore = (score) => {
  const percentage = score * PERCENT_MULTIPLIER;
  return `${percentage}%`.padStart(4, " ");
};

module.exports = {
  formatDate,
  formatScore,
};
