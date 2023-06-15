/**
 * Extracts audit scores from an audit.
 *
 * @param {Object} audit - The audit to extract scores from.
 * @return {Object} - The extracted audit scores.
 */
function extractAuditScores(audit) {
  if (!audit || !audit.auditResult) return {};

  const { performance, accessibility, 'best-practices': bestPractices, seo } = audit.auditResult.categories;
  return {
    performance: performance.score,
    accessibility: accessibility.score,
    bestPractices: bestPractices.score,
    seo: seo.score
  };
}

/**
 * Extracts total blocking time from an audit.
 *
 * @param {Object} lastAudit - The audit to extract tbt from.
 * @return {Object} - The extracted tbt.
 */
function extractTotalBlockingTime(lastAudit) {
  return lastAudit?.['total-blocking-time']?.displayValue || null;
}

/**
 * Extracts third party summary from an audit.
 *
 * @param {Object} lastAudit - The audit to extract third party summary from.
 * @return {Object} - The extracted third party summary.
 */
function extractThirdPartySummary(lastAudit) {
  const items = lastAudit?.['third-party-summary']?.details?.items || [];

  return Object.values(items)
    .map((item) => {
      return {
        entity: item.entity,
        blockingTime: item.blockingTime,
        mainThreadTime: item.mainThreadTime,
        transferSize: item.transferSize,
      }
    })
}

module.exports = {
  extractAuditScores,
  extractThirdPartySummary,
  extractTotalBlockingTime,
};
