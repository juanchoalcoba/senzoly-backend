const express = require('express');
const {
  getServices,
  getServiceStats,
  getServiceById,
  createService,
  patchService,
  replaceServiceImage,
  deleteServiceImage,
} = require('../controllers/serviceCatalogController');
const authMiddleware = require('../../middlewares/authMiddleware');
const { uploadServiceImage } = require('../../middlewares/serviceImageUpload');

const router = express.Router();

// Todas las rutas de servicios requieren autenticación JWT
router.use(authMiddleware);

router.get('/', getServices);
router.get('/stats', getServiceStats);
router.get('/:id', getServiceById);
router.post('/', createService);
router.patch('/:id', patchService);
router.patch('/:id/image', uploadServiceImage, replaceServiceImage);
router.delete('/:id/image', deleteServiceImage);

module.exports = router;
