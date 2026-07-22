const { getAllBusinessTypes } = require('../repositories/catalogRepository');
const { successResponse, errorResponse } = require('../../utils/responseUtils');
const db = require('../../config/db');

const getBusinessTypes = async (req, res) => {
  const client = await db.getClient();
  try {
    const businessTypes = await getAllBusinessTypes(client);
    return successResponse(res, businessTypes, 'Rubros obtenidos exitosamente');
  } catch (error) {
    console.error('Error fetching business types:', error);
    return errorResponse(res, 'Error al obtener los rubros', [], 500);
  } finally {
    client.release();
  }
};

module.exports = {
  getBusinessTypes,
};
