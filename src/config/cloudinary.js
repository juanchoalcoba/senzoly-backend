const { v2: cloudinary } = require('cloudinary');

const requiredVariables = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missingVariables = () => requiredVariables.filter((name) => !process.env[name]);

const ensureCloudinaryConfigured = () => {
  const missing = missingVariables();
  if (missing.length > 0) {
    const error = new Error(`Faltan variables de Cloudinary: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = { cloudinary, ensureCloudinaryConfigured };
