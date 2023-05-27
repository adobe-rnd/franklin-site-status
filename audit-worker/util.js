const axios = require('axios');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getApiUrl = (siteUrl) => {
  const urlParameters = new URLSearchParams({
    url: siteUrl,
    key: process.env.PAGESPEED_API_KEY,
  });

  return `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${urlParameters.toString()}&category=performance&category=accessibility&category=best-practices&category=seo`;
}

const getAuditTTL = () => {
  // Retrieve the TTL from environment variables or default to 30
  let auditTtlDays = parseInt(process.env.AUDIT_TTL_DAYS) || 30;

  // Check if the parsed value is a valid integer and is greater than 0
  if (!Number.isInteger(auditTtlDays) || auditTtlDays <= 0) {
    console.warn(`Invalid AUDIT_TTL_DAYS environment variable value: ${process.env.AUDIT_TTL_DAYS}. Using default value of 30.`);
    auditTtlDays = 30;
  }

  // Convert the TTL from days to seconds
  return auditTtlDays * 24 * 60 * 60;
}

const processAuditData = (data) => {
  for (let key in data) {
    if (typeof data[key] === 'object' && data[key] !== null) {
      processAuditData(data[key]);
    }

    if (key.includes('.')) {
      const newKey = key.replace('.', '_');
      data[newKey] = data[key];
      delete data[key];
    }
  }
}

const auditSite = async (domain) => {
  const apiURL = getApiUrl(`https://${domain}`);

  const { data: lhs } = await axios.get(apiURL);

  processAuditData(lhs);

  return lhs;
}

module.exports = {
  auditSite,
  getAuditTTL,
  sleep,
}
