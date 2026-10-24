const FALLBACK_GTQ_PER_USD = 7.78;
const CACHE_DURATION_MS = 60 * 60 * 1000;

let cachedRate = null;

const round = (value, decimals = 4) => Number(value.toFixed(decimals));

async function getUsdExchangeRate() {
  const now = Date.now();
  if (cachedRate && now - cachedRate.fetchedAt < CACHE_DURATION_MS) {
    return { ...cachedRate, cached: true };
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Servicio de moneda respondió ${response.status}`);

    const data = await response.json();
    const gtqPerUsd = Number(data?.rates?.GTQ);
    if (!Number.isFinite(gtqPerUsd) || gtqPerUsd <= 0) {
      throw new Error('La tasa GTQ/USD recibida no es válida.');
    }

    cachedRate = {
      gtqPerUsd: round(gtqPerUsd),
      usdPerGtq: round(1 / gtqPerUsd, 6),
      source: 'open.er-api.com',
      updatedAt: data.time_last_update_utc || new Date().toISOString(),
      fetchedAt: now,
      cached: false,
      fallback: false,
    };
    return cachedRate;
  } catch (error) {
    return {
      gtqPerUsd: FALLBACK_GTQ_PER_USD,
      usdPerGtq: round(1 / FALLBACK_GTQ_PER_USD, 6),
      source: 'respaldo local',
      updatedAt: new Date().toISOString(),
      fetchedAt: now,
      cached: false,
      fallback: true,
      warning: 'No fue posible consultar la tasa en línea; se aplicó la tasa de respaldo.',
    };
  }
}

async function convertGtqToUsd(amountGTQ) {
  const rate = await getUsdExchangeRate();
  return {
    ...rate,
    amountGTQ: Number(amountGTQ),
    amountUSD: Number((Number(amountGTQ) / rate.gtqPerUsd).toFixed(2)),
  };
}

module.exports = { getUsdExchangeRate, convertGtqToUsd };
