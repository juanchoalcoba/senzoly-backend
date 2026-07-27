const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const sender = process.env.EMAIL_FROM || 'Senzoly <hola@senzoly.com>';

const sendVerificationEmail = async (to, token) => {
  const verifyLink = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;

  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to: [to],
      subject: 'Verifica tu cuenta en Senzoly',
      html: `
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
          </head>
          <body style="margin:0; padding:0; background-color:#f5f7fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
            <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">Confirma tu correo electrónico para activar tu cuenta de Senzoly.</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fb;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:560px; background-color:#ffffff; border-radius:16px; overflow:hidden;">
                    <tr><td style="height:6px; background-color:#ff6b00; font-size:0; line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding:40px 36px 36px;">
                        <p style="margin:0 0 24px; color:#ff6b00; font-size:20px; font-weight:700; letter-spacing:-0.3px;">Senzoly</p>
                        <h1 style="margin:0 0 16px; color:#111827; font-size:28px; line-height:36px; font-weight:700; letter-spacing:-0.4px;">Confirma tu correo electrónico</h1>
                        <p style="margin:0 0 12px; color:#4b5563; font-size:16px; line-height:24px;">Gracias por registrarte. Para activar tu cuenta, confirma que esta dirección de correo es tuya.</p>
                        <p style="margin:0 0 28px; color:#4b5563; font-size:16px; line-height:24px;">El enlace vence en 24 horas.</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center" bgcolor="#ff6b00" style="border-radius:8px;">
                              <a href="${verifyLink}" target="_blank" style="display:inline-block; padding:14px 24px; border:1px solid #ff6b00; border-radius:8px; color:#ffffff; background-color:#ff6b00; font-size:16px; font-weight:700; line-height:20px; text-align:center; text-decoration:none;">Verificar mi correo</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:30px 0 0; color:#6b7280; font-size:14px; line-height:21px;">Si no creaste una cuenta en Senzoly, puedes ignorar este correo.</p>
                        <p style="margin:24px 0 0; color:#9ca3af; font-size:12px; line-height:18px;">¿El botón no funciona? Copia y pega este enlace en tu navegador:<br><a href="${verifyLink}" target="_blank" style="color:#6b7280; text-decoration:underline; word-break:break-all;">${verifyLink}</a></p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:20px 0 0; color:#9ca3af; font-size:12px; line-height:18px;">© ${new Date().getFullYear()} Senzoly</p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return false; // Retornamos false, pero no rompemos la transacción de la BD
    }
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
};

const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    const { error } = await resend.emails.send({
      from: sender,
      to: [to],
      subject: 'Restablece tu contraseña de Senzoly',
      html: `
        <h1>Restablece tu contraseña</h1>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
        <p>Este enlace vence en una hora y solo puede usarse una vez.</p>
        <a href="${resetLink}" style="padding: 10px 20px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 5px;">Crear nueva contraseña</a>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
