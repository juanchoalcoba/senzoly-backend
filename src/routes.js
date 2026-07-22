const express = require('express');
const router = express.Router();

// Healthcheck endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Senzoly OS API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
