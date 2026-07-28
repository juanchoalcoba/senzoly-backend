const express = require('express');
const { getEmployees, createNewEmployee, updateExistingEmployee, removeEmployee, regenerateToken } = require('../controllers/employeeController');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas de empleados requieren autenticación de tenant
router.use(authMiddleware);

router.get('/', getEmployees);
router.post('/', createNewEmployee);
router.patch('/:id', updateExistingEmployee);
router.post('/:id/regenerate-token', regenerateToken);
router.delete('/:id', removeEmployee);

module.exports = router;
