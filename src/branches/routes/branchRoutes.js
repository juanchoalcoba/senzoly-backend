const express = require('express');
const {
  getBranches,
  createNewBranch,
  updateExistingBranch,
  uploadImage,
  deleteImage,
  deleteBranchController,
} = require('../controllers/branchController');
const authMiddleware = require('../../middlewares/authMiddleware');
const { uploadBranchImage } = require('../../middlewares/branchImageUpload');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getBranches);
router.post('/', createNewBranch);
router.patch('/:id', updateExistingBranch);
router.patch('/:id/image', uploadBranchImage, uploadImage);
router.delete('/:id/image', deleteImage);
router.delete('/:id', deleteBranchController);

module.exports = router;
