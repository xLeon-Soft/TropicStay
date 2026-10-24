# API y pruebas manuales de TropicStay

## 1. Preparar el entorno

1. Copia `server/.env.example` como `server/.env` y configura `MONGODB_URI`, `JWT_SECRET` y `GOOGLE_CLIENT_ID`.
2. Con MongoDB iniciado, ejecuta en dos terminales:

   ```powershell
   npm run seed          # opcional: reinicia e inserta datos de muestra
   npm run start:server
   npm run start:client
   ```

3. Comprueba `GET http://localhost:5000/api/health`. Debe devolver HTTP 200, `success: true` y `status: "ok"`.

El cliente Angular usa `/api`; el archivo `client/proxy.conf.json` lo redirige a `http://localhost:5000` durante desarrollo. No hay que cambiar URLs en los servicios del frontend.

## 2. Autenticación para Postman

Las operaciones que escriben datos necesitan el encabezado:

```http
Authorization: Bearer <token>
```

El proyecto usa Google Sign-In, por lo que la manera segura de obtener el token de prueba es:

1. Abre `http://localhost:4200/login` e inicia sesión con Google.
2. En las herramientas de desarrollo del navegador abre **Application > Session Storage > http://localhost:4200**.
3. Copia el campo `token` dentro de `tropicstay_google_user`.
4. En Postman importa la colección y establece la variable `token`.

No se creó un usuario, contraseña o token de prueba oculto. Así las pruebas usan el mismo mecanismo que el frontend. Un token vence a las 8 horas.

El endpoint que utiliza el frontend es `POST /api/auth/google` con el cuerpo `{ "credential": "<Google ID token>" }`. Normalmente no se llama a mano desde Postman porque el ID token lo obtiene el botón oficial de Google; el token JWT devuelto por ese endpoint es el que se coloca en la variable `token` de la colección.

## 3. Consultas públicas

| Método | Ruta | Consulta disponible |
| --- | --- | --- |
| GET | `/api/health` | Estado de API y hora. |
| GET | `/api/chalets` | `search`, `department`, `category`, `minPrice`, `maxPrice`, `guests`, `minRating`, `amenities` (separadas por coma), `sort=price-asc|price-desc|rating-desc`. |
| GET | `/api/chalets/:id` | Chalet, anfitrión y reseñas. |
| GET | `/api/chalets/:id/reviews` | Reseñas de un chalet. |
| GET | `/api/chalets/meta/departments` | Departamentos con chalets registrados. |
| GET | `/api/hosts` | Todos los anfitriones. |
| GET | `/api/hosts/:id` | Anfitrión y sus chalets. |

Ejemplos:

```http
GET /api/chalets?department=Sololá&guests=4&minRating=4.5&sort=price-asc
GET /api/chalets?category=Lago&amenities=Wifi%20de%20alta%20velocidad,Piscina%20privada
GET /api/chalets?search=Atitlán&minPrice=1000&maxPrice=3000
```

## 4. Operaciones autenticadas

| Método | Ruta | Quién puede usarla |
| --- | --- | --- |
| POST | `/api/chalets` | Usuario autenticado. Queda como propietario/anfitrión del chalet. |
| PUT | `/api/chalets/:id` | Propietario o admin. |
| DELETE | `/api/chalets/:id` | Propietario o admin. Elimina también sus reseñas. |
| POST | `/api/uploads/images` | Usuario autenticado; `form-data`, campo `images`, hasta 10 JPG/PNG/WEBP/GIF de 8 MB. |
| POST | `/api/chalets/:id/reviews` | Usuario autenticado; la identidad se toma del token. |
| POST | `/api/bookings` | Usuario autenticado. Valida fechas, capacidad y solapamiento. |
| GET | `/api/bookings` | Huésped: sus reservas. Anfitrión: también reservas de sus chalets. Filtros `status` y `chaletId`. |
| GET | `/api/bookings/:id` | Huésped de la reserva, anfitrión del chalet o admin. |
| PATCH | `/api/bookings/:id/status` | Huésped solo puede cancelar; anfitrión/admin puede cambiar estado. |

Ejemplo mínimo para crear chalet:

```json
{
  "title": "Chalet de prueba frente al lago",
  "category": "Lago",
  "department": "Sololá",
  "municipality": "Panajachel",
  "location": ["Panajachel, Sololá"],
  "description": "Propiedad usada solamente para pruebas manuales.",
  "pricePerNight": 1500,
  "guestsMax": 4,
  "bedrooms": 2,
  "beds": 3,
  "bathrooms": 2,
  "images": ["https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200"],
  "thumbnail": "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200",
  "amenities": ["Wifi de alta velocidad", "Piscina privada"],
  "rules": ["No fumar"]
}
```

Ejemplo de reserva:

```json
{
  "chaletId": "{{chaletId}}",
  "guestName": "Nombre de prueba",
  "guestEmail": "correo@ejemplo.com",
  "guestPhone": "+50255555555",
  "checkIn": "2026-11-20",
  "checkOut": "2026-11-23",
  "guestsCount": 2,
  "notes": "Reserva de prueba desde Postman"
}
```

Importa [TropicStay.postman_collection.json](../postman/TropicStay.postman_collection.json) en Postman. Ejecuta primero **Crear chalet**: el script de prueba guarda su ID en `chaletId`; después puedes ejecutar reserva, reseña, consulta, actualización y borrado.

También está disponible una comprobación automática de solo lectura para los endpoints públicos:

```powershell
cd server
npm run test:smoke
```
