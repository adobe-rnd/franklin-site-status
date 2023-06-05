const axios = require('axios');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getApiUrl = (siteUrl) => {
  const urlParameters = new URLSearchParams({
    url: siteUrl,
    key: process.env.PAGESPEED_API_KEY,
  });

  return `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${urlParameters.toString()}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile`;
}

const getAuditTTL = () => {
  let auditTtlDays = parseInt(process.env.AUDIT_TTL_DAYS) || 30;

  if (!Number.isInteger(auditTtlDays) || auditTtlDays <= 0) {
    console.warn(`Invalid AUDIT_TTL_DAYS environment variable value: ${process.env.AUDIT_TTL_DAYS}. Using default value of 30.`);
    auditTtlDays = 30;
  }

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

const performPSICheck = async (domain) => {
  const apiURL = getApiUrl(`https://${domain}`);

  const { data: lhs } = await axios.get(apiURL);

  processAuditData(lhs);

  return lhs;
}

module.exports = {
  performPSICheck,
  getAuditTTL,
  sleep,
}
