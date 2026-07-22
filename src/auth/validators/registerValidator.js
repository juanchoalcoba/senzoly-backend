const { z } = require('zod');

const registerSchema = z.object({
  company: z.object({
    name: z.string().trim().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
    businessTypeId: z.string().uuid('ID de rubro inválido'),
    country: z.string().trim().min(2, 'El país es requerido'),
  }),
  owner: z.object({
    firstName: z.string().trim().min(2, 'El nombre es requerido'),
    lastName: z.string().trim().min(2, 'El apellido es requerido'),
    email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  }),
});

const validateRegister = (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    req.body = validatedData; // reemplazamos con datos saneados (trimmed, minúsculas, etc)
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors,
      });
    }
    next(error);
  }
};

module.exports = {
  validateRegister,
};
