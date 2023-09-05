const axios = require('axios');

function PSIClient(config) {
  const  { apiKey, baseUrl } = config;

  /**
   * Formats an input URL to be HTTPS.
   *
   * @param {string} input - The input URL.
   * @returns {string} The formatted URL with HTTPS.
   */
  const formatURL = (input) => {
    const urlPattern = /^https?:\/\//i;

    if (urlPattern.test(input)) {
      return input.replace(/^http:/i, 'https:');
    } else {
      return `https://${input}`;
    }
  }

  /**
   * Builds a PageSpeed Insights API URL with the necessary parameters.
   *
   * @param {string} siteUrl - The URL of the site to analyze.
   * @returns {string} The full API URL with parameters.
   */
  const getPSIApiUrl = (siteUrl) => {
    const params = new URLSearchParams({
      url: formatURL(siteUrl),
      key: apiKey,
      strategy: 'mobile'
    });

    ['performance', 'accessibility', 'best-practices', 'seo'].forEach(category => {
      params.append('category', category);
    });

    return `${[baseUrl]}?${params.toString()}`;
  };

  /**
   * Processes audit data by replacing keys with dots with underscore.
   *
   * @param {object} data - The audit data object.
   * @returns {object} The processed audit data.
   */
  const processAuditData = (data) => {
    if (!data) {
      return null;
    }

    const newData = { ...data };

    for (let key in newData) {
      if (typeof newData[key] === 'object' && newData[key] !== null) {
        newData[key] = processAuditData(newData[key]);
      }

      if (key.includes('.')) {
        const newKey = key.replace(/\./g, '_');
        newData[newKey] = newData[key];
        delete newData[key];
      }
    }

    return newData;
  };

  /**
   * Performs a PageSpeed Insights check on the specified domain.
   *
   * @param {string} domain - The domain to perform the PSI check on.
   * @returns {Promise<object>} The processed PageSpeed Insights audit data.
   */
  const performPSICheck = async (domain) => {
    const apiURL = getPSIApiUrl(domain);

    const { data: lhs } = await axios.get(apiURL);

    return processAuditData(lhs);
  };

  return {
    formatURL,
    getPSIApiUrl,
    performPSICheck,
    processAuditData,
  }
}

module.exports = PSIClient;
