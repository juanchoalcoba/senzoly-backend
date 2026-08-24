const { v4: uuidv4 } = require('uuid');
const { messaging } = require('../../config/firebaseAdmin');

const getFrontendUrl = () => {
  return (process.env.FRONTEND_URL || process.env.APP_URL || 'https://senzoly.com').replace(/\/$/, '');
};

const registerFcmToken = async (client, tokenData) => {
  const { tenantId, userId, customerId, bookingId, token, deviceType = 'web' } = tokenData;
  if (!token) return null;

  const id = uuidv4();
  const query = `
    INSERT INTO fcm_tokens (id, tenant_id, user_id, customer_id, booking_id, token, device_type, last_used_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (token)
    DO UPDATE SET
      tenant_id = COALESCE(EXCLUDED.tenant_id, fcm_tokens.tenant_id),
      user_id = COALESCE(EXCLUDED.user_id, fcm_tokens.user_id),
      customer_id = COALESCE(EXCLUDED.customer_id, fcm_tokens.customer_id),
      booking_id = COALESCE(EXCLUDED.booking_id, fcm_tokens.booking_id),
      last_used_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const res = await client.query(query, [id, tenantId || null, userId || null, customerId || null, bookingId || null, token, deviceType]);
  return res.rows[0];
};

const sendPushToTokens = async (clientPool, tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;

  const msgService = messaging();
  if (!msgService) {
    console.log('[NotificationService] Firebase Messaging no disponible para enviar push.');
    return;
  }

  try {
    const response = await msgService.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });

    // Limpieza de tokens inválidos u obsoletos
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await clientPool.query(`DELETE FROM fcm_tokens WHERE token = ANY($1::text[])`, [invalidTokens]);
        console.log(`[NotificationService] Se eliminaron ${invalidTokens.length} tokens FCM obsoletos.`);
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error enviando notificaciones multicast:', error.message);
  }
};

const sendBookingConfirmationNotifications = async (clientPool, bookingData) => {
  try {
    const { booking, customer, service, tenant, manageToken } = bookingData;
    const frontendUrl = getFrontendUrl();
    const manageUrl = manageToken ? `${frontendUrl}/reserva/gestionar/${manageToken}` : `${frontendUrl}/reserva/${tenant.slug}`;

    // 1. Notificar a los administradores / usuarios del Tenant
    const tenantTokensRes = await clientPool.query(
      `SELECT DISTINCT token FROM fcm_tokens WHERE tenant_id = $1`,
      [tenant.id]
    );
    const tenantTokens = tenantTokensRes.rows.map(r => r.token);

    if (tenantTokens.length > 0) {
      const title = `📅 Nueva reserva recibida`;
      const body = `${customer.first_name} ${customer.last_name} reservó ${service.name} para el ${booking.booking_date} a las ${booking.start_time.substring(0, 5)} hs.`;
      await sendPushToTokens(clientPool, tenantTokens, title, body, {
        url: `${frontendUrl}/dashboard/bookings`,
        type: 'NEW_BOOKING',
      });
    }

    // 2. Notificar al Cliente (si registró token FCM)
    const customerTokensRes = await clientPool.query(
      `SELECT DISTINCT token FROM fcm_tokens WHERE customer_id = $1 OR booking_id = $2`,
      [customer.id, booking.id]
    );
    const customerTokens = customerTokensRes.rows.map(r => r.token);

    if (customerTokens.length > 0) {
      const title = `✅ Reserva Confirmada en ${tenant.name}`;
      const body = `Tu cita de ${service.name} quedó agendada para el ${booking.booking_date} a las ${booking.start_time.substring(0, 5)} hs.`;
      await sendPushToTokens(clientPool, customerTokens, title, body, {
        url: manageUrl,
        type: 'BOOKING_CONFIRMED',
      });
    }
  } catch (error) {
    console.error('[NotificationService] Error en sendBookingConfirmationNotifications:', error.message);
  }
};

const sendBookingCancellationNotifications = async (clientPool, bookingData) => {
  try {
    const { booking, customer, service, tenant } = bookingData;
    const frontendUrl = getFrontendUrl();

    // 1. Notificar al Tenant Owner / Empleados
    const tenantTokensRes = await clientPool.query(
      `SELECT DISTINCT token FROM fcm_tokens WHERE tenant_id = $1`,
      [tenant.id]
    );
    const tenantTokens = tenantTokensRes.rows.map(r => r.token);

    if (tenantTokens.length > 0) {
      const title = `🔴 Reserva Cancelada`;
      const body = `${customer.first_name} ${customer.last_name} canceló la reserva de ${service.name} del ${booking.booking_date} a las ${booking.start_time.substring(0, 5)} hs. Cupo liberado.`;
      await sendPushToTokens(clientPool, tenantTokens, title, body, {
        url: `${frontendUrl}/dashboard/bookings`,
        type: 'BOOKING_CANCELED',
      });
    }

    // 2. Notificar al Cliente
    const customerTokensRes = await clientPool.query(
      `SELECT DISTINCT token FROM fcm_tokens WHERE customer_id = $1 OR booking_id = $2`,
      [customer.id, booking.id]
    );
    const customerTokens = customerTokensRes.rows.map(r => r.token);

    if (customerTokens.length > 0) {
      const title = `❌ Reserva Cancelada`;
      const body = `Tu turno de ${service.name} en ${tenant.name} ha sido cancelado correctamente.`;
      await sendPushToTokens(clientPool, customerTokens, title, body, {
        url: `${frontendUrl}/reserva/${tenant.slug}`,
        type: 'BOOKING_CANCELED',
      });
    }
  } catch (error) {
    console.error('[NotificationService] Error en sendBookingCancellationNotifications:', error.message);
  }
};

// Worker de Recordatorios Automáticos (5 Horas y 1 Hora antes del turno)
const processScheduledReminders = async (clientPool) => {
  try {
    const frontendUrl = getFrontendUrl();

    // --- Recordatorios de 5 Horas ---
    // Usamos (NOW() AT TIME ZONE 'America/Montevideo') para calcular la hora local real del negocio
    const query5h = `
      SELECT b.id, b.tenant_id, b.customer_id, b.booking_date, b.start_time, b.manage_token_hash,
             c.first_name, c.last_name, s.name AS service_name, t.name AS tenant_name, t.slug AS tenant_slug
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN services s ON b.service_id = s.id
      JOIN tenants t ON b.tenant_id = t.id
      WHERE b.status = 'CONFIRMED'
        AND b.reminder_5h_sent = false
        AND (b.booking_date + b.start_time) <= ((NOW() AT TIME ZONE 'America/Montevideo') + INTERVAL '5 hours')
        AND (b.booking_date + b.start_time) > ((NOW() AT TIME ZONE 'America/Montevideo') + INTERVAL '1 hour');
    `;
    const res5h = await clientPool.query(query5h);

    for (const row of res5h.rows) {
      const customerTokensRes = await clientPool.query(
        `SELECT DISTINCT token FROM fcm_tokens WHERE customer_id = $1 OR booking_id = $2`,
        [row.customer_id, row.id]
      );
      const tokens = customerTokensRes.rows.map(r => r.token);

      if (tokens.length > 0) {
        const title = `⏰ Recordatorio de Cita (en 5 horas)`;
        const body = `Hola ${row.first_name}, te recordamos tu cita de ${row.service_name} hoy a las ${row.start_time.substring(0, 5)} hs en ${row.tenant_name}.`;
        await sendPushToTokens(clientPool, tokens, title, body, {
          url: `${frontendUrl}/reserva/${row.tenant_slug}`,
          type: 'REMINDER_5H',
        });
        await clientPool.query(`UPDATE bookings SET reminder_5h_sent = true WHERE id = $1`, [row.id]);
      } else {
        // Si aún no hay token registrado pero el turno ya pasó la ventana de 5h y se acerca a la de 1h, evitamos reintentar infinitamente
        const isPast5hWindow = await clientPool.query(
          `SELECT 1 FROM bookings WHERE id = $1 AND (booking_date + start_time) <= ((NOW() AT TIME ZONE 'America/Montevideo') + INTERVAL '1 hour')`,
          [row.id]
        );
        if (isPast5hWindow.rows.length > 0) {
          await clientPool.query(`UPDATE bookings SET reminder_5h_sent = true WHERE id = $1`, [row.id]);
        }
      }
    }

    // --- Recordatorios de 1 Hora ---
    const query1h = `
      SELECT b.id, b.tenant_id, b.customer_id, b.booking_date, b.start_time, b.manage_token_hash,
             c.first_name, c.last_name, s.name AS service_name, t.name AS tenant_name, t.slug AS tenant_slug
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN services s ON b.service_id = s.id
      JOIN tenants t ON b.tenant_id = t.id
      WHERE b.status = 'CONFIRMED'
        AND b.reminder_1h_sent = false
        AND (b.booking_date + b.start_time) <= ((NOW() AT TIME ZONE 'America/Montevideo') + INTERVAL '1 hour')
        AND (b.booking_date + b.start_time) > (NOW() AT TIME ZONE 'America/Montevideo');
    `;
    const res1h = await clientPool.query(query1h);

    for (const row of res1h.rows) {
      const customerTokensRes = await clientPool.query(
        `SELECT DISTINCT token FROM fcm_tokens WHERE customer_id = $1 OR booking_id = $2`,
        [row.customer_id, row.id]
      );
      const tokens = customerTokensRes.rows.map(r => r.token);

      if (tokens.length > 0) {
        const title = `🚨 ¡Tu turno es en 1 hora!`;
        const body = `${row.first_name}, tu cita de ${row.service_name} en ${row.tenant_name} comienza a las ${row.start_time.substring(0, 5)} hs.`;
        await sendPushToTokens(clientPool, tokens, title, body, {
          url: `${frontendUrl}/reserva/${row.tenant_slug}`,
          type: 'REMINDER_1H',
        });
        await clientPool.query(`UPDATE bookings SET reminder_1h_sent = true WHERE id = $1`, [row.id]);
      } else {
        const isPast1hWindow = await clientPool.query(
          `SELECT 1 FROM bookings WHERE id = $1 AND (booking_date + start_time) <= (NOW() AT TIME ZONE 'America/Montevideo')`,
          [row.id]
        );
        if (isPast1hWindow.rows.length > 0) {
          await clientPool.query(`UPDATE bookings SET reminder_1h_sent = true WHERE id = $1`, [row.id]);
        }
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error procesando recordatorios programados:', error.message);
  }
};

module.exports = {
  registerFcmToken,
  sendPushToTokens,
  sendBookingConfirmationNotifications,
  sendBookingCancellationNotifications,
  processScheduledReminders,
};
