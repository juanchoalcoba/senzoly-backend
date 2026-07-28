const tenantRepo = require('../repositories/tenantRepository');
const { TENANT_STATUSES } = require('../tenantStatus');

const listTenants = async (client) => tenantRepo.listTenants(client);

const getTenantDetails = async (client, tenantId) => {
  const tenant = await tenantRepo.getTenantDetails(client, tenantId);
  if (!tenant) throw new Error('Empresa no encontrada');
  return tenant;
};

const changeTenantStatus = async (client, tenantId, status) => {
  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) {
    throw new Error('No se puede modificar una empresa eliminada');
  }

  return tenantRepo.updateTenantStatus(client, tenantId, status);
};

const suspendTenant = async (client, tenantId) => (
  changeTenantStatus(client, tenantId, TENANT_STATUSES.SUSPENDED)
);

const reactivateTenant = async (client, tenantId) => (
  changeTenantStatus(client, tenantId, TENANT_STATUSES.ACTIVE)
);

const softDeleteTenant = async (client, tenantId) => {
  const tenant = await getTenantDetails(client, tenantId);
  if (tenant.status === TENANT_STATUSES.DELETED) return tenant;
  return tenantRepo.softDeleteTenant(client, tenantId, TENANT_STATUSES.DELETED);
};

module.exports = {
  listTenants,
  getTenantDetails,
  suspendTenant,
  reactivateTenant,
  softDeleteTenant,
};
