const customerRepo = require('../repositories/customerRepository');

const listCustomers = async (client, tenantId, search) => {
  return await customerRepo.getCustomersByTenant(client, tenantId, search);
};

const getCustomerDetails = async (client, tenantId, id) => {
  const customer = await customerRepo.getCustomerById(client, tenantId, id);
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }
  return customer;
};

const modifyCustomer = async (client, id, tenantId, updateData) => {
  const existing = await customerRepo.getCustomerById(client, tenantId, id);
  if (!existing) {
    throw new Error('Cliente no encontrado');
  }
  return await customerRepo.updateCustomer(client, id, tenantId, updateData);
};

const getCustomerOverview = async (client, tenantId) => {
  return await customerRepo.getCustomerStats(client, tenantId);
};

module.exports = {
  listCustomers,
  getCustomerDetails,
  modifyCustomer,
  getCustomerOverview,
};
