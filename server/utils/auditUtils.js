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

module.exports = {
  extractAuditScores,
};
