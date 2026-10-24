const { convertGtqToUsd, getUsdExchangeRate } = require('../services/currencyService');

// GET /api/currency/usd?gtq=2800
exports.getUsdPrice = async (req, res) => {
  const { gtq } = req.query;
  if (gtq !== undefined && (!Number.isFinite(Number(gtq)) || Number(gtq) < 0)) {
    return res.status(400).json({ success: false, message: 'gtq debe ser un número mayor o igual a cero.' });
  }

  const data = gtq === undefined
    ? await getUsdExchangeRate()
    : await convertGtqToUsd(Number(gtq));

  return res.json({ success: true, data });
};
