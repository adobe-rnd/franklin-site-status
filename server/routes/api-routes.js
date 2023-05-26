const express = require('express');
const apiController = require('../controllers/api-controller');
const { verifyAPIKey } = require('../middlewares/api-key-middleware');

const router = express.Router();

router.get('/status/:domain', verifyAPIKey(process.env.USER_API_KEY), apiController.getStatus);
router.get('/sites', verifyAPIKey(process.env.USER_API_KEY), apiController.getSites);
router.post('/import', verifyAPIKey(process.env.ADMIN_API_KEY), apiController.triggerImport);

module.exports = router;
