const { randomUUID: uuidv7 } = require('crypto');

const deleteActiveTokensByUserId = async (client, userId) => {
  await client.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL;',
    [userId]
  );
};

const createPasswordResetToken = async (client, userId, tokenHash, expiresAt) => {
  const result = await client.query(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `, [uuidv7(), userId, tokenHash, expiresAt]);

  return result.rows[0];
};

const findActiveTokenByHash = async (client, tokenHash) => {
  const result = await client.query(`
    SELECT id, user_id, expires_at
    FROM password_reset_tokens
    WHERE token_hash = $1 AND used_at IS NULL;
  `, [tokenHash]);

  return result.rows[0] || null;
};

const markTokensAsUsedByUserId = async (client, userId) => {
  await client.query(`
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND used_at IS NULL;
  `, [userId]);
};

module.exports = {
  deleteActiveTokensByUserId,
  createPasswordResetToken,
  findActiveTokenByHash,
  markTokensAsUsedByUserId,
};
