const crypto = require('crypto');
const { cloudinary, ensureCloudinaryConfigured } = require('../config/cloudinary');

const safeFolderSegment = (value) => String(value || 'tenant')
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || 'tenant';

const uploadServiceImage = ({ buffer, tenantSlug, serviceId }) => {
  ensureCloudinaryConfigured();

  const folder = `senzoly/${safeFolderSegment(tenantSlug)}/services`;
  const publicId = `service-${serviceId}-${crypto.randomUUID()}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      public_id: publicId,
      resource_type: 'image',
      overwrite: false,
      transformation: [
        { width: 1600, height: 1200, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    }, (error, result) => {
      if (error) return reject(error);
      return resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id });
    });

    stream.end(buffer);
  });
};

const destroyImage = async (publicId) => {
  if (!publicId) return;
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
};

module.exports = { uploadServiceImage, destroyImage };
