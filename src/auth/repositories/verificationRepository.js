const createVerification = async (client, id, userId, token) => {
  // Establecemos expiración de 24 horas por defecto
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const query = `
    INSERT INTO email_verifications (id, user_id, token, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [id, userId, token, expiresAt];
  
  const result = await client.query(query, values);
  return result.rows[0];
};

const findVerificationByToken = async (client, token) => {
  const query = `
    SELECT id, user_id, expires_at, verified_at
    FROM email_verifications 
    WHERE token = $1;
  `;
  const result = await client.query(query, [token]);
  return result.rows[0] || null;
};

const markVerificationAsUsed = async (client, id) => {
  const query = `
    UPDATE email_verifications
    SET verified_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `;
  await client.query(query, [id]);
};

module.exports = {
  createVerification,
  findVerificationByToken,
  markVerificationAsUsed,
};
