const express = require('express');
const router = express.Router();
const hostController = require('../controllers/hostController');

router.get('/', hostController.getHosts);
router.get('/:id', hostController.getHostById);

module.exports = router;
