const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (to, token) => {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Senzoly <onboarding@resend.dev>', // Usando el dominio por defecto de pruebas de resend
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

module.exports = {
  sendVerificationEmail,
};
