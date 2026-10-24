const express = require('express');
const { getUsdPrice } = require('../controllers/currencyController');

const router = express.Router();

router.get('/usd', getUsdPrice);

module.exports = router;
