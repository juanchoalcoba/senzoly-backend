const express = require('express');
const { register } = require('../controllers/registerController');
const { login } = require('../controllers/loginController');
const { superAdminLogin } = require('../controllers/superAdminAuthController');
const { verifyEmail } = require('../controllers/verificationController');
const { validateRegister } = require('../validators/registerValidator');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);
router.post('/super-admin/login', superAdminLogin);

module.exports = router;
