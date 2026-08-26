const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv7 } = require('crypto');
const db = require('../../config/db');
const { generateSlug } = require('../../utils/slugUtils');
const { sendVerificationEmail } = require('../../utils/emailService');

const tenantRepo = require('../../tenant/repositories/tenantRepository');
const subscriptionRepo = require('../../subscriptions/repositories/subscriptionRepository');
const userRepo = require('../../users/repositories/userRepository');
const verificationRepo = require('../repositories/verificationRepository');
const catalogRepo = require('../../catalogs/repositories/catalogRepository');
const settingsRepo = require('../../settings/repositories/settingsRepository');

const TERMS_VERSION = '2026-07';

const registerCompany = async (payload) => {
  const { company, owner } = payload;
  
  // 1. Obtener cliente de la DB para iniciar transacción
  const client = await db.getClient();

  try {
    // Validar si el email ya existe
    const existingUser = await userRepo.findUserByEmail(client, owner.email);
    if (existingUser) {
      throw new Error('El correo electrónico ya se encuentra registrado');
    }

    // Validar el businessType
    const businessType = await catalogRepo.findBusinessTypeById(client, company.businessTypeId);
    if (!businessType) {
      throw new Error('El rubro seleccionado no es válido');
    }

    // Obtener plan básico
    const basicPlan = await catalogRepo.findPlanBySlug(client, 'prueba');
    if (!basicPlan) {
      throw new Error('No se encontró el plan de suscripción básico');
    }

    // 2. Iniciar Transacción
    await client.query('BEGIN');

    // Generar datos base
    const tenantId = uuidv7();
    const subscriptionId = uuidv7();
    const userId = uuidv7();
    const verificationId = uuidv7();
    const slug = generateSlug(company.name) + '-' + Math.random().toString(36).substring(2, 6); // Asegurar unicidad

    // Crear Tenant
    await tenantRepo.createTenant(
      client,
      tenantId,
      company.businessTypeId,
      company.name,
      slug,
      company.country
    );

    await settingsRepo.upsertBookingSettings(client, tenantId, {
      slotIntervalMinutes: businessType.slug === 'canchas' ? 60 : 30,
      slotAlignment: businessType.slug === 'canchas' ? 'CLOCK_HOUR' : 'BUSINESS_OPEN',
    });

    // Crear Suscripción (Plan Básico, status TRIAL de 30 días)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    await subscriptionRepo.createSubscription(
      client,
      subscriptionId,
      tenantId,
      basicPlan.id,
      'TRIAL',
      now,
      expiresAt
    );

    // Hashear Password y crear Owner
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(owner.password, saltRounds);
    
    await userRepo.createUser(
      client,
      userId,
      tenantId,
      owner.firstName,
      owner.lastName,
      owner.email,
      passwordHash,
      TERMS_VERSION
    );

    // Generar token seguro y guardarlo
    const token = crypto.randomBytes(32).toString('hex');
    await verificationRepo.createVerification(client, verificationId, userId, token);

    // 3. Confirmar Transacción
    await client.query('COMMIT');

    // 4. Enviar email (no bloquea ni deshace transacción si falla)
    // Se ejecuta de manera asíncrona sin await para no demorar la respuesta al cliente
    sendVerificationEmail(owner.email, token).catch((err) => {
      console.error('Error no crítico al enviar email en background:', err);
    });

    return { success: true };

  } catch (error) {
    // Si falla algo, deshacer los cambios en la BD
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Liberar cliente devuelta al pool
    client.release();
  }
};

module.exports = {
  registerCompany,
};
