export const validateApiKey = (key): void => {
  if (!key || key.trim() === '') {
    throw new Error('API key is not set or empty.');
  }
}

export const formatDate = (isoDate: string | null): string => {
  if (isoDate === null) {
    return "N/A";
  }

  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toISOString().replace("T", " ").slice(0, 19);
};

