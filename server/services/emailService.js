const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    return null;
  }

  if (host) {
    return {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      auth: { user, pass },
    };
  }

  if (user.toLowerCase().endsWith('@gmail.com')) {
    return {
      service: 'gmail',
      auth: { user, pass },
    };
  }

  return null;
}

function isSmtpConfigured() {
  return Boolean(getSmtpConfig());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Envía un código OTP de 6 dígitos para recuperar la contraseña de TropicStay.
 * Si SMTP no está configurado en entorno local (NODE_ENV !== 'production'),
 * registra el código en consola para permitir pruebas locales sin bloquear el flujo.
 */
async function sendPasswordResetCode({ to, name, code, expiresMinutes = 15 }) {
  const smtpConfig = getSmtpConfig();
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@tropicstay.gt').trim();
  const safeName = escapeHtml(name || 'Viajero');
  const safeCode = escapeHtml(code);

  const subject = `Tu código de recuperación TropicStay: ${code}`;
  const text = [
    `Hola ${name || 'Viajero'},`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta en TropicStay.',
    `Tu código de verificación de 6 dígitos es: ${code}`,
    '',
    `Este código vence en ${expiresMinutes} minutos.`,
    'Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f4f7f6; padding:32px 16px; color:#102a23;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:18px; border:1px solid #d9e6e1; overflow:hidden; box-shadow:0 12px 30px rgba(13,82,68,0.08);">
        <div style="background:linear-gradient(135deg,#0d5244,#083e33); padding:24px 28px; color:#ffffff;">
          <div style="font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#99f6e4; font-weight:700;">TropicStay Guatemala</div>
          <h1 style="margin:6px 0 0; font-size:22px; font-weight:700;">Recuperación de cuenta</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 14px; font-size:15px; line-height:1.55;">Hola <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 20px; font-size:15px; line-height:1.55; color:#475467;">
            Usa el siguiente código de verificación de 6 dígitos para cambiar tu contraseña y recuperar el acceso a tu cuenta:
          </p>
          <div style="background:#f5faf8; border:2px dashed #0d5244; border-radius:14px; padding:18px; text-align:center; margin-bottom:20px;">
            <span style="display:inline-block; font-size:34px; font-weight:800; letter-spacing:8px; color:#0d5244; font-family:monospace;">${safeCode}</span>
          </div>
          <p style="margin:0 0 12px; font-size:13px; color:#d97736; font-weight:700;">
            ⏱️ Este código vence en ${expiresMinutes} minutos y permite máximo 5 intentos.
          </p>
          <p style="margin:0; font-size:13px; color:#667085; line-height:1.5;">
            Si no solicitaste restablecer tu contraseña, ignora este correo; tu cuenta permanecerá segura.
          </p>
        </div>
      </div>
    </div>
  `;

  if (!smtpConfig) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('El servicio de correo SMTP no está configurado en el servidor.');
    }

    console.info(
      `\n[TropicStay Mail Preview] Código de recuperación para ${to}: ${code} (vence en ${expiresMinutes} min)\n`
    );
    return {
      delivered: false,
      mode: 'local-preview',
    };
  }

  const transporter = nodemailer.createTransport(smtpConfig);
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    mode: 'smtp',
    messageId: info.messageId,
  };
}

module.exports = {
  sendPasswordResetCode,
  isSmtpConfigured,
};
