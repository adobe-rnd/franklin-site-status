const express = require('express');
const apiController = require('../controllers/api-controller');
const { verifyAPIKey } = require('../middlewares/api-key-middleware');

const router = express.Router();

// user apis
router.get('/sites', verifyAPIKey(process.env.USER_API_KEY), apiController.getSites);
router.get('/sites/:domain', verifyAPIKey(process.env.USER_API_KEY), apiController.getSite);
router.get('/sites/:domain/martech', verifyAPIKey(process.env.USER_API_KEY), apiController.getMartechImpact);
router.get('/sites.xlsx', verifyAPIKey(process.env.USER_API_KEY), apiController.exportSitesToExcel);
router.get('/sites.csv', verifyAPIKey(process.env.USER_API_KEY), apiController.exportSitesToCSV);

// admin apis
router.post('/admin/queue/all', verifyAPIKey(process.env.ADMIN_API_KEY), apiController.auditAllSites);

module.exports = router;
