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

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

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

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Manejo global de errores (ej: JSON malformado)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
//EXITO 
