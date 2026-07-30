const crypto = require('crypto');

const webhookSignatureMiddleware = (req, res, next) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('[Webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado. Verificación de firma omitida.');
    return next();
  }

  const xSignature = req.headers['x-signature'];
  if (!xSignature) {
    console.warn('[Webhook] X-Signature header no presente. Verificación omitida.');
    return next();
  }

  const xRequestId = req.headers['x-request-id'] || '';

  const dataId = req.query['data.id'] || '';

  const parts = xSignature.split(',');
  let ts = '';
  let hash = '';

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.substring(0, eqIndex).trim();
    const value = part.substring(eqIndex + 1).trim();
    if (key === 'ts') {
      ts = value;
    } else if (key === 'v1') {
      hash = value;
    }
  }

  if (!ts || !hash) {
    console.warn('[Webhook] Formato de X-Signature inválido:', xSignature);
    return next();
  }

  const manifestParts = [];
  if (dataId) {
    manifestParts.push(`id:${dataId.toLowerCase()}`);
  }
  if (xRequestId) {
    manifestParts.push(`request-id:${xRequestId}`);
  }
  manifestParts.push(`ts:${ts}`);
  const manifest = manifestParts.join(';') + ';';

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[Webhook] Firma HMAC inválida.');
      console.error('[Webhook]   Esperada:', expectedSignature);
      console.error('[Webhook]   Recibida:', hash);
      console.error('[Webhook]   Manifiesto:', manifest);
      return res.status(401).json({ success: false, message: 'Firma de webhook inválida' });
    }
  } catch (err) {
    console.error('[Webhook] Error al comparar firmas HMAC:', err.message);
    return res.status(401).json({ success: false, message: 'Error al verificar firma de webhook' });
  }

  console.log('[Webhook] Firma HMAC verificada exitosamente.');
  next();
};

module.exports = webhookSignatureMiddleware;
