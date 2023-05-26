function verifyAPIKey(apiKey) {
  return (req, res, next) => {
    const apiKeyFromHeader = req.get('X-API-KEY');
    if (!apiKeyFromHeader || apiKeyFromHeader !== apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}

module.exports = {
  verifyAPIKey
};
