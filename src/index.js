require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./auth/routes/authRoutes');
const catalogRoutes = require('./catalogs/routes/catalogRoutes');
const superAdminRoutes = require('./superAdmin/routes/superAdminRoutes');
const userRoutes = require('./users/routes/userRoutes');
const employeeRoutes = require('./employees/routes/employeeRoutes');
const customerRoutes = require('./customers/routes/customerRoutes');
const serviceCatalogRoutes = require('./servicesCatalog/routes/serviceCatalogRoutes');
const settingsRoutes = require('./settings/routes/settingsRoutes');
const publicRoutes = require('./public/routes/publicRoutes');
const bookingRoutes = require('./bookings/routes/bookingRoutes');
const staffPortalRoutes = require('./staffPortal/routes/staffPortalRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const productionOrigins = new Set([
  'https://senzoly.com',
  'https://www.senzoly.com',
]);
const developmentOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const allowedOrigins = isProduction ? productionOrigins : new Set([...productionOrigins, ...developmentOrigins]);

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatoria en producción');
}

// Railway termina TLS en su proxy; Express debe confiar en ese salto para
// reconocer la petición original como HTTPS.
if (isProduction) app.set('trust proxy', 1);

// Middlewares
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    // Las peticiones sin Origin (health checks, servidores y herramientas internas)
    // no están sujetas a CORS, que es una protección del navegador.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado por la política CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '1mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceCatalogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/staff-portal', staffPortalRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Manejo global de errores (ej: JSON malformado)
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (err.message === 'Origen no autorizado por la política CORS') {
    return res.status(403).json({ success: false, message: 'Origen no autorizado' });
  }
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
//EXIT
