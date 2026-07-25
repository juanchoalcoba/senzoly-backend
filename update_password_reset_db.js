require('dotenv').config();
const db = require('./src/config/db');

async function updatePasswordResetDb() {
  const client = await db.getClient();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
        ON password_reset_tokens(user_id);
    `);
    console.log('Tabla de recuperación de contraseña preparada correctamente.');
  } catch (error) {
    console.error('Error al preparar la recuperación de contraseña:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

updatePasswordResetDb();
