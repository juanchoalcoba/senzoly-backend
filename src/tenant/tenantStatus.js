const TENANT_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
};

const isTenantOperational = (status) => (
  status === TENANT_STATUSES.TRIAL || status === TENANT_STATUSES.ACTIVE
);

const getTenantAccessMessage = (status) => {
  if (status === TENANT_STATUSES.SUSPENDED) {
    return 'Tu cuenta se encuentra suspendida. Comunícate con Senzoly para obtener más información.';
  }

  return 'Esta cuenta no se encuentra disponible.';
};

module.exports = {
  TENANT_STATUSES,
  isTenantOperational,
  getTenantAccessMessage,
};
