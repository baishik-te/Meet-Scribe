const router = require('express').Router();
const AdminController = require('../controller/admin.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate, authorize('ADMIN'));

router.post('/plans', AdminController.createPlan);
router.patch('/plans/:id', AdminController.updatePlan);
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.post('/adjust-tokens', AdminController.adjustTokens);
router.get('/ledger', AdminController.listAllLedgers);
router.get('/calls', AdminController.listCalls);

module.exports = router;