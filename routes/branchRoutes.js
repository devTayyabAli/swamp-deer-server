const express = require('express');
const router = express.Router();
const { getBranches, createBranch, updateBranch } = require('../controllers/branchController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(getBranches).post(protect, admin, createBranch);
router.route('/:id').put(protect, admin, updateBranch);

module.exports = router;
