const slugify = require('slugify');

/**
 * Genera un slug seguro a partir de un string.
 * @param {string} text - El texto a convertir a slug
 * @returns {string} El slug generado
 */
const generateSlug = (text) => {
  return slugify(text, {
    replacement: '-',  // reemplazar espacios con guiones
    lower: true,       // convertir a minúsculas
    strict: true,      // quitar caracteres especiales
    trim: true         // quitar espacios al inicio y final
  });
};

module.exports = {
  generateSlug,
};
