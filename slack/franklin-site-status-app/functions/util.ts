function validateApiKey(key) {
  if (!key || key.trim() === '') {
    throw new Error('API key is not set or empty.');
  }
}

export default validateApiKey;
