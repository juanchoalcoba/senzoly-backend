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
        <h1>Bienvenido a Senzoly</h1>
        <p>Por favor verifica tu correo electrónico haciendo click en el siguiente enlace:</p>
        <a href="${verifyLink}" style="padding: 10px 20px; background-color: #FF6B00; color: white; text-decoration: none; border-radius: 5px;">Verificar mi correo</a>
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
