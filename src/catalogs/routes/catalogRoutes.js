const express = require('express');
const { getBusinessTypes } = require('../controllers/catalogController');

const router = express.Router();

router.get('/business-types', getBusinessTypes);

module.exports = router;
