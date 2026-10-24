const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TropicStay API - Alquiler de Chalets en Guatemala',
    version: '1.0.0',
    description: `API RESTful para la plataforma TropicStay, que gestiona el catálogo de chalets vacacionales en Guatemala, reservas, reseñas, perfiles de anfitriones y subida de imágenes.

### Autenticación
Los endpoints protegidos requieren un token JWT en el encabezado:
\`Authorization: Bearer <tu_token_jwt>\`

Puedes autorizarte pulsando el botón **Authorize** e introduciendo el token JWT obtenido desde el login de la aplicación web o el endpoint \`/api/auth/google\`.`,
    contact: {
      name: 'Soporte TropicStay',
      email: 'soporte@tropicstay.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Servidor local de desarrollo',
    },
  ],
  tags: [
    { name: 'Autenticación', description: 'Inicio de sesión con Google y generación de tokens JWT' },
    { name: 'Chalets', description: 'Búsqueda, catálogo y administración de chalets' },
    { name: 'Reservas', description: 'Gestión y seguimiento de reservas de chalets' },
    { name: 'Reseñas', description: 'Calificaciones y opiniones de los huéspedes' },
    { name: 'Anfitriones', description: 'Perfiles de anfitriones y sus propiedades' },
    { name: 'Archivos', description: 'Subida y almacenamiento de imágenes' },
    { name: 'Sistema', description: 'Monitoreo de estado y salud del backend' },
    { name: 'Moneda', description: 'Conversión de precios de Quetzales a dólares estadounidenses' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Introduce el token JWT obtenido en el inicio de sesión.',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operación realizada con éxito' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Descripción detallada del error.' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66c5a01f4c71a3e890123456' },
          name: { type: 'string', example: 'Carlos Mendoza' },
          email: { type: 'string', example: 'carlos@tropicstay.gt' },
          phone: { type: 'string', example: '+502 5555-0000' },
          avatar: { type: 'string', example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' },
          role: { type: 'string', enum: ['guest', 'host', 'admin'], example: 'host' },
          verified: { type: 'boolean', example: true },
          superhost: { type: 'boolean', example: true },
          rating: { type: 'number', example: 4.9 },
          reviewsCount: { type: 'number', example: 28 },
          responseTime: { type: 'string', example: 'menos de 15 min' },
          memberSince: { type: 'string', example: '2023' },
          bio: { type: 'string', example: 'Apasionado por la hospitalidad y por compartir la belleza de Guatemala.' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Chalet: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66c5a01f4c71a3e890123789' },
          title: { type: 'string', example: 'Chalet Vista al Lago Atitlán' },
          category: { type: 'string', enum: ['Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'], example: 'Lago' },
          department: { type: 'string', example: 'Sololá' },
          municipality: { type: 'string', example: 'Panajachel' },
          location: { type: 'array', items: { type: 'string' }, example: ['Lago de Atitlán, Sololá', 'Muelle privado'] },
          description: { type: 'string', example: 'Hermosa villa frente al lago con vistas panorámicas a los volcanes.' },
          pricePerNight: { type: 'number', example: 1500 },
          priceUSD: { type: 'number', example: 193 },
          deposit: { type: 'number', example: 500 },
          cleaningFee: { type: 'number', example: 150 },
          guestsMax: { type: 'integer', example: 6 },
          bedrooms: { type: 'integer', example: 3 },
          beds: { type: 'integer', example: 4 },
          bathrooms: { type: 'integer', example: 2 },
          images: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200'],
          },
          thumbnail: { type: 'string', example: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200' },
          rating: { type: 'number', example: 4.9 },
          reviewsCount: { type: 'integer', example: 12 },
          ratingBreakdown: {
            type: 'object',
            properties: {
              cleanliness: { type: 'number', example: 4.9 },
              accuracy: { type: 'number', example: 4.8 },
              communication: { type: 'number', example: 5.0 },
              location: { type: 'number', example: 4.9 },
              value: { type: 'number', example: 4.8 },
            },
          },
          amenities: {
            type: 'array',
            items: { type: 'string' },
            example: ['Wifi de alta velocidad', 'Piscina privada', 'Jacuzzi', 'Cocina equipada'],
          },
          rules: {
            type: 'array',
            items: { type: 'string' },
            example: ['No fumar dentro del chalet', 'Mascotas bienvenidas previa confirmación'],
          },
          host: { $ref: '#/components/schemas/User' },
          featured: { type: 'boolean', example: true },
          status: { type: 'string', enum: ['disponible', 'reservado', 'mantenimiento'], example: 'disponible' },
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number', example: 14.7356 },
              lng: { type: 'number', example: -91.2025 },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ChaletInput: {
        type: 'object',
        required: ['title', 'category', 'department', 'municipality', 'location', 'description', 'pricePerNight', 'guestsMax', 'bedrooms', 'beds', 'bathrooms', 'images'],
        properties: {
          title: { type: 'string', example: 'Chalet de Ensueño en Río Dulce' },
          category: { type: 'string', enum: ['Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'], example: 'Río' },
          department: { type: 'string', example: 'Izabal' },
          municipality: { type: 'string', example: 'Livingston' },
          location: { type: 'array', items: { type: 'string' }, example: ['Río Dulce, Izabal'] },
          description: { type: 'string', example: 'Muelle privado, terraza con vista panorámica y rodeado de naturaleza tropical.' },
          pricePerNight: { type: 'number', example: 1800 },
          priceUSD: { type: 'number', example: 231 },
          deposit: { type: 'number', example: 600 },
          cleaningFee: { type: 'number', example: 200 },
          guestsMax: { type: 'integer', example: 8 },
          bedrooms: { type: 'integer', example: 4 },
          beds: { type: 'integer', example: 5 },
          bathrooms: { type: 'integer', example: 3 },
          images: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200'],
          },
          thumbnail: { type: 'string', example: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200' },
          amenities: {
            type: 'array',
            items: { type: 'string' },
            example: ['Muelle privado', 'Wifi', 'Piscina', 'Aire acondicionado'],
          },
          rules: {
            type: 'array',
            items: { type: 'string' },
            example: ['No fiestas ruidosas después de las 22:00'],
          },
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number', example: 15.656 },
              lng: { type: 'number', example: -88.995 },
            },
          },
        },
      },
      ChaletUpdateInput: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Chalet Vista Actualizada' },
          category: { type: 'string', enum: ['Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'] },
          department: { type: 'string' },
          municipality: { type: 'string' },
          location: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          pricePerNight: { type: 'number', example: 1650 },
          priceUSD: { type: 'number' },
          deposit: { type: 'number' },
          cleaningFee: { type: 'number' },
          guestsMax: { type: 'integer' },
          bedrooms: { type: 'integer' },
          beds: { type: 'integer' },
          bathrooms: { type: 'integer' },
          images: { type: 'array', items: { type: 'string' } },
          thumbnail: { type: 'string' },
          amenities: { type: 'array', items: { type: 'string' } },
          rules: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['disponible', 'reservado', 'mantenimiento'], example: 'disponible' },
          featured: { type: 'boolean' },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66c5a01f4c71a3e890123999' },
          guest: { $ref: '#/components/schemas/User' },
          chalet: { $ref: '#/components/schemas/Chalet' },
          guestName: { type: 'string', example: 'María López' },
          guestEmail: { type: 'string', example: 'maria@ejemplo.com' },
          guestPhone: { type: 'string', example: '+502 4444-1111' },
          checkIn: { type: 'string', format: 'date-time', example: '2026-11-20T00:00:00.000Z' },
          checkOut: { type: 'string', format: 'date-time', example: '2026-11-23T00:00:00.000Z' },
          guestsCount: { type: 'integer', example: 4 },
          nights: { type: 'integer', example: 3 },
          totalPriceGTQ: { type: 'number', example: 4650 },
          notes: { type: 'string', example: 'Llegaremos aproximadamente a las 4:00 PM.' },
          status: { type: 'string', enum: ['confirmada', 'pendiente', 'cancelada'], example: 'confirmada' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BookingInput: {
        type: 'object',
        required: ['chaletId', 'guestName', 'guestEmail', 'guestPhone', 'checkIn', 'checkOut', 'guestsCount'],
        properties: {
          chaletId: { type: 'string', example: '66c5a01f4c71a3e890123789', description: 'ID de MongoDB del chalet a reservar' },
          guestName: { type: 'string', example: 'María López' },
          guestEmail: { type: 'string', example: 'maria@ejemplo.com' },
          guestPhone: { type: 'string', example: '+502 4444-1111' },
          checkIn: { type: 'string', format: 'date', example: '2026-11-20', description: 'Fecha de llegada en formato YYYY-MM-DD' },
          checkOut: { type: 'string', format: 'date', example: '2026-11-23', description: 'Fecha de salida en formato YYYY-MM-DD' },
          guestsCount: { type: 'integer', example: 4, description: 'Número de huéspedes (no puede exceder guestsMax del chalet)' },
          notes: { type: 'string', example: 'Viajamos en vehículo particular.' },
        },
      },
      BookingStatusInput: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['confirmada', 'pendiente', 'cancelada'],
            example: 'cancelada',
            description: 'Nuevo estado de la reserva. El huésped solo puede cancelar su propia reserva; el anfitrión/admin puede cambiar a cualquier estado.',
          },
        },
      },
      Review: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66c5a01f4c71a3e890123555' },
          chalet: { type: 'string', example: '66c5a01f4c71a3e890123789' },
          authorName: { type: 'string', example: 'Juan Pérez' },
          authorAvatar: { type: 'string', example: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
          rating: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          comment: { type: 'string', example: '¡Una experiencia inolvidable! El chalet estaba impecable y la vista es espectacular.' },
          cleanliness: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          location: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          communication: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          value: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          date: { type: 'string', format: 'date-time' },
        },
      },
      ReviewInput: {
        type: 'object',
        required: ['comment'],
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5, example: 5, default: 5 },
          comment: { type: 'string', example: 'Excelente estadía, muy recomendado.' },
          cleanliness: { type: 'number', minimum: 1, maximum: 5, example: 5, default: 5 },
          location: { type: 'number', minimum: 1, maximum: 5, example: 5, default: 5 },
          communication: { type: 'number', minimum: 1, maximum: 5, example: 5, default: 5 },
          value: { type: 'number', minimum: 1, maximum: 5, example: 5, default: 5 },
        },
      },
      GoogleLoginInput: {
        type: 'object',
        required: ['credential'],
        properties: {
          credential: {
            type: 'string',
            description: 'Google ID Token obtenido mediante el flujo de Google Identity Services en el cliente.',
            example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
          },
        },
      },
      GoogleLoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Alejandro Morales' },
              email: { type: 'string', example: 'alejandro@ejemplo.com' },
              picture: { type: 'string', example: 'https://lh3.googleusercontent.com/a/...' },
            },
          },
        },
      },
      UploadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          urls: {
            type: 'array',
            items: { type: 'string' },
            example: ['http://localhost:5000/uploads/1729182391000-84729183.webp'],
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'TropicStay API' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // -------------------------------------------------------------------------
    // SISTEMA / HEALTH
    // -------------------------------------------------------------------------
    '/api/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Comprobar el estado y salud de la API',
        description: 'Retorna el estado de operatividad del backend, nombre del servicio y marca de tiempo actual.',
        responses: {
          200: {
            description: 'Servicio en funcionamiento correcto',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },

    '/api/currency/usd': {
      get: {
        tags: ['Moneda'],
        summary: 'Consultar la tasa USD/GTQ y convertir un monto',
        description: 'Retorna la tasa actual de Quetzales por dólar. Al enviar `gtq`, también retorna el precio equivalente en USD. La API usa una tasa local de respaldo si el proveedor externo no está disponible.',
        parameters: [
          { name: 'gtq', in: 'query', required: false, schema: { type: 'number', minimum: 0, example: 2800 }, description: 'Monto en Quetzales a convertir.' },
        ],
        responses: {
          200: { description: 'Tasa y conversión obtenidas correctamente.' },
          400: { description: 'Monto gtq inválido.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // -------------------------------------------------------------------------
    // AUTENTICACIÓN
    // -------------------------------------------------------------------------
    '/api/auth/google': {
      post: {
        tags: ['Autenticación'],
        summary: 'Autenticación con Google Sign-In',
        description: 'Recibe un ID Token de Google (`credential`), valida la firma con los servidores de Google, crea o actualiza el usuario en MongoDB y genera un token JWT firmado válido por 8 horas.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GoogleLoginInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Autenticación exitosa. Retorna el JWT de acceso y el perfil del usuario.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GoogleLoginResponse' },
              },
            },
          },
          400: {
            description: 'Petición inválida (falta la credencial de Google).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Credencial de Google no válida o no verificada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'Variables de entorno no configuradas en el servidor.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // CHALETS
    // -------------------------------------------------------------------------
    '/api/chalets': {
      get: {
        tags: ['Chalets'],
        summary: 'Listar y filtrar chalets',
        description: 'Obtiene el listado de chalets disponibles con soporte de filtros combinados por búsqueda de texto, departamento, categoría, rango de precios, cantidad de huéspedes, puntuación mínima, comodidades y ordenamiento.',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por texto libre en título, departamento, municipio, descripción o ubicación.' },
          { name: 'department', in: 'query', schema: { type: 'string' }, description: 'Filtrar por departamento de Guatemala (ej: Sololá, Petén, Izabal, Sacatepéquez).' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'] }, description: 'Categoría geográfica del chalet.' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Precio mínimo por noche en GTQ.' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Precio máximo por noche en GTQ.' },
          { name: 'guests', in: 'query', schema: { type: 'integer' }, description: 'Capacidad mínima de huéspedes requerida.' },
          { name: 'minRating', in: 'query', schema: { type: 'number' }, description: 'Calificación mínima promedio del chalet (1 a 5).' },
          { name: 'amenities', in: 'query', schema: { type: 'string' }, description: 'Comodidades requeridas separadas por coma (ej: "Wifi de alta velocidad,Piscina privada").' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price-asc', 'price-desc', 'rating-desc'] }, description: 'Criterio de ordenamiento de los resultados.' },
        ],
        responses: {
          200: {
            description: 'Lista de chalets obtenida exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 10 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Chalet' },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: 'Error al consultar la base de datos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      post: {
        tags: ['Chalets'],
        summary: 'Crear un nuevo chalet',
        description: 'Registra un nuevo chalet en el catálogo. Requiere autenticación con token Bearer; el usuario autenticado quedará asignado como propietario/anfitrión del chalet. Si su rol era "guest", se promueve automáticamente a "host".',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChaletInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Chalet registrado y publicado con éxito.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Chalet publicado con éxito' },
                    data: { $ref: '#/components/schemas/Chalet' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Datos del chalet inválidos o incompletos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'No autorizado (token faltante o expirado).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/chalets/meta/departments': {
      get: {
        tags: ['Chalets'],
        summary: 'Listar departamentos con chalets disponibles',
        description: 'Retorna la lista única de departamentos de Guatemala donde actualmente existen chalets registrados.',
        responses: {
          200: {
            description: 'Lista de departamentos devuelta exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Sololá', 'Izabal', 'Sacatepéquez', 'Petén', 'Escuintla', 'Alta Verapaz'],
                    },
                  },
                },
              },
            },
          },
          500: {
            description: 'Error del servidor.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/chalets/meta/destinations': {
      get: {
        tags: ['Chalets'],
        summary: 'Listar destinos disponibles',
        description: 'Retorna los municipios únicos con las categorías de chalet disponibles en cada uno.',
        responses: {
          200: {
            description: 'Lista de destinos devuelta exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', example: 'Antigua Guatemala' },
                          categories: { type: 'array', items: { type: 'string' }, example: ['Colonial'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: 'Error del servidor.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/chalets/{id}': {
      get: {
        tags: ['Chalets'],
        summary: 'Obtener detalle de un chalet por su ID',
        description: 'Obtiene la información completa del chalet, incluyendo el perfil del anfitrión y la lista de reseñas ordenadas cronológicamente.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del chalet.' },
        ],
        responses: {
          200: {
            description: 'Detalle del chalet obtenido con éxito.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/Chalet' },
                        {
                          type: 'object',
                          properties: {
                            reviews: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Review' },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Identificador del chalet no válido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Chalet no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      put: {
        tags: ['Chalets'],
        summary: 'Actualizar un chalet existente',
        description: 'Modifica los campos del chalet especificado. Solo permitido para el anfitrión propietario del chalet o un administrador.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del chalet a modificar.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChaletUpdateInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Chalet actualizado correctamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Chalet actualizado correctamente.' },
                    data: { $ref: '#/components/schemas/Chalet' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Datos inválidos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'No tienes permisos para modificar este chalet.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Chalet no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Chalets'],
        summary: 'Eliminar un chalet',
        description: 'Elimina de forma permanente el chalet y todas sus reseñas asociadas. Solo permitido para el anfitrión propietario o un administrador.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del chalet a eliminar.' },
        ],
        responses: {
          200: {
            description: 'Chalet y reseñas eliminados correctamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Chalet y sus reseñas eliminados correctamente.' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Identificador no válido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'No tienes permisos para eliminar este chalet.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Chalet no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // RESEÑAS
    // -------------------------------------------------------------------------
    '/api/chalets/{id}/reviews': {
      get: {
        tags: ['Reseñas'],
        summary: 'Obtener todas las reseñas de un chalet',
        description: 'Retorna el listado de opiniones y valoraciones dejadas por huéspedes para el chalet especificado, ordenadas de la más reciente a la más antigua.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del chalet.' },
        ],
        responses: {
          200: {
            description: 'Lista de reseñas del chalet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 5 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Review' },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'ID de chalet no válido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'Error al consultar reseñas.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      post: {
        tags: ['Reseñas'],
        summary: 'Agregar una reseña a un chalet',
        description: 'Publica una nueva reseña y calificación. Requiere autenticación; el nombre y avatar del autor se extraen automáticamente del token. Recalcula y actualiza automáticamente el promedio general y el desglose de calificaciones del chalet.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del chalet al que se añade la reseña.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReviewInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Reseña agregada y promedio del chalet actualizado.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Reseña agregada correctamente.' },
                    data: { $ref: '#/components/schemas/Review' },
                    updatedChaletRating: { type: 'number', example: 4.9 },
                    updatedReviewsCount: { type: 'integer', example: 13 },
                  },
                },
              },
            },
          },
          400: {
            description: 'Comentario vacío o ID inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'No autorizado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Chalet no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // RESERVAS
    // -------------------------------------------------------------------------
    '/api/bookings': {
      get: {
        tags: ['Reservas'],
        summary: 'Listar reservas del usuario',
        description: 'Consulta las reservas vinculadas a la cuenta autenticada. Si el usuario es huésped, visualiza sus propias reservas. Si es anfitrión, visualiza también las reservas hechas en los chalets de su propiedad. Los administradores pueden ver todas las reservas del sistema.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['confirmada', 'pendiente', 'cancelada'] }, description: 'Filtrar por estado de la reserva.' },
          { name: 'chaletId', in: 'query', schema: { type: 'string' }, description: 'Filtrar por ID específico de chalet.' },
        ],
        responses: {
          200: {
            description: 'Lista de reservas obtenida correctamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 2 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Booking' },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'No autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'Error interno del servidor.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      post: {
        tags: ['Reservas'],
        summary: 'Crear una nueva reserva',
        description: 'Crea una reserva para el chalet indicado. Valida que las fechas no se solapen con otras reservas activas, que el número de personas no exceda el límite del chalet, y calcula automáticamente el número de noches y el precio total en Quetzales (noches * precio + tarifa de limpieza).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BookingInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Reserva creada y confirmada exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Reserva confirmada correctamente.' },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Fechas inválidas, campos faltantes o capacidad excedida.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'No autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Chalet no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'Conflicto: El chalet ya se encuentra reservado para esas fechas.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/bookings/{id}': {
      get: {
        tags: ['Reservas'],
        summary: 'Obtener detalle de una reserva por su ID',
        description: 'Obtiene todos los datos de la reserva, huésped y chalet. Solo accesible por el huésped que reservó, el anfitrión del chalet o un administrador.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB de la reserva.' },
        ],
        responses: {
          200: {
            description: 'Detalle de la reserva.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Identificador no válido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'No tienes permisos para ver esta reserva.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Reserva no encontrada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/bookings/{id}/status': {
      patch: {
        tags: ['Reservas'],
        summary: 'Actualizar estado de una reserva (confirmar o cancelar)',
        description: 'Modifica el estado de una reserva. El huésped que realizó la reserva solo puede cambiar su estado a "cancelada". El anfitrión del chalet y el administrador pueden cambiar el estado a "confirmada", "pendiente" o "cancelada".',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB de la reserva.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BookingStatusInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Estado de la reserva actualizado exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Estado de reserva actualizado.' },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Estado no válido o ID incorrecto.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          403: {
            description: 'Permiso denegado para modificar este estado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: {
            description: 'Reserva no encontrada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // ANFITRIONES
    // -------------------------------------------------------------------------
    '/api/hosts': {
      get: {
        tags: ['Anfitriones'],
        summary: 'Listar anfitriones',
        description: 'Retorna la lista de usuarios con rol de anfitrión ("host") registrados en TropicStay.',
        responses: {
          200: {
            description: 'Lista de anfitriones obtenida con éxito.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 4 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: 'Error al consultar anfitriones.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/hosts/{id}': {
      get: {
        tags: ['Anfitriones'],
        summary: 'Obtener anfitrión por ID y sus chalets',
        description: 'Obtiene el perfil completo de un anfitrión junto con el listado de todos los chalets que administra.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID de MongoDB del anfitrión.' },
        ],
        responses: {
          200: {
            description: 'Perfil de anfitrión y chalets obtenidos con éxito.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/User' },
                        {
                          type: 'object',
                          properties: {
                            chalets: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Chalet' },
                            },
                            chaletsCount: { type: 'integer', example: 3 },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          404: {
            description: 'Anfitrión no encontrado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          500: {
            description: 'Error al obtener la información.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // SUBIDA DE ARCHIVOS / IMÁGENES
    // -------------------------------------------------------------------------
    '/api/uploads/images': {
      post: {
        tags: ['Archivos'],
        summary: 'Subir imágenes de chalets',
        description: 'Permite subir hasta 10 imágenes (JPG, PNG, WEBP o GIF) de hasta 8 MB cada una. Requiere autenticación. Devuelve las URLs públicas accesibles para ser asignadas a un chalet.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary',
                    },
                    description: 'Archivos de imagen a subir (máximo 10 archivos).',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Imágenes subidas correctamente. Retorna las URLs absolutas.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadResponse' },
              },
            },
          },
          400: {
            description: 'Archivo inválido o tamaño excedido (> 8 MB).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'No autorizado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
  },
};

const swaggerUiOptions = {
  customSiteTitle: 'TropicStay API - Swagger UI',
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin-top: 20px; }
    .swagger-ui .info .title { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; color: #0f172a; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
  },
};

module.exports = {
  swaggerUi,
  swaggerSpec,
  swaggerUiOptions,
};
