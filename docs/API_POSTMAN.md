# API y pruebas manuales en Postman — TropicStay

## 1. Preparar el entorno

1. Verifica `server/.env` con `MONGODB_URI`, `JWT_SECRET` y `GOOGLE_CLIENT_ID`.
2. Con MongoDB iniciado, arranca backend y frontend desde la raíz:

   ```powershell
   npm run seed          # opcional: reinicia e inserta datos de muestra
   npm run start:server
   npm run start:client
   ```

3. Comprueba `GET http://localhost:5000/api/health`. Debe devolver HTTP `200`, `status: "ok"` y `database: "connected"`.
4. También puedes abrir la documentación Swagger en `http://localhost:5000/api-docs`.

## 2. Autenticación rápida para Postman (sin copiar tokens manuales)

Las colecciones actualizadas incluyen solicitudes automáticas para **Anfitrión** (`hostToken` / `token`) y **Huésped** (`guestToken`) mediante correo y contraseña:

- `POST /api/auth/register` (`name`, `email`, `password`, `phone`, `role`: `"host" | "guest"`)
- `POST /api/auth/login` (`email`, `password`)
- `POST /api/auth/google` (`credential` — Google ID token)
- `POST /api/auth/forgot-password` (`email` — envía código OTP de 6 dígitos por correo)
- `POST /api/auth/verify-reset-code` (`email`, `code` — verifica vigencia del código antes del cambio)
- `POST /api/auth/reset-password` (`email`, `code`, `newPassword` — actualiza contraseña)
- `POST /api/auth/stream-ticket` (emite ticket efímero de 60 s para SSE)
- `GET /api/auth/me` (perfil autenticado)
- `PUT /api/auth/profile` (actualizar `name`, `phone`, `bio`, `responseTime`, `avatar`, `role`)
- `GET /api/auth/avatar/:userId` (proxy seguro de avatar)

> Importante: un propietario no puede reservar ni dejar reseñas en su propio chalet (`400` / `403`). Por eso las colecciones guardan **`hostToken`** para publicar/editar chalets y confirmar citas o reservas, y **`guestToken`** para pedir citas, reservar, reseñar y chatear.

## 3. Consultas públicas

| Método | Ruta | Descripción / Parámetros |
| --- | --- | --- |
| GET | `/api/health` | Estado de API, MongoDB y clientes SSE conectados. |
| GET | `/api/currency/usd?gtq=2800` | Tipo de cambio y conversión GTQ → USD. |
| GET | `/api/chalets` | Filtros: `search`, `department`, `municipality`, `category`, `minPrice`, `maxPrice`, `guests`, `minRating`, `amenities`, `checkIn`, `checkOut`, `sort`. |
| GET | `/api/chalets/meta/departments` | Departamentos con chalets registrados. |
| GET | `/api/chalets/meta/destinations` | Municipios/destinos con chalets registrados. |
| GET | `/api/chalets/:id` | Detalle completo del chalet, anfitrión, reseñas y fechas ocupadas. |
| GET | `/api/chalets/:id/booked-dates` | Rangos de fechas reservadas (`confirmada` o `pendiente`). |
| GET | `/api/chalets/:id/reviews` | Reseñas del chalet. |
| GET | `/api/hosts` | Lista de anfitriones. |
| GET | `/api/hosts/:id` | Perfil del anfitrión y sus chalets. |
| GET | `/api/events/public-stream` | Stream SSE público para cambios de chalet en tiempo real. |

## 4. Operaciones autenticadas (escriben en MongoDB)

| Método | Ruta | Quién puede usarla / Detalles |
| --- | --- | --- |
| POST | `/api/chalets` | Anfitrión (`hostToken`). Acepta `location` como arreglo de strings y calcula `priceUSD`. |
| PUT | `/api/chalets/:id` | Propietario o admin. Permite cambiar `status` (`disponible`, `reservado`, `mantenimiento`) con broadcast SSE inmediato. |
| DELETE | `/api/chalets/:id` | Propietario o admin. Elimina chalet y sus reseñas. |
| POST | `/api/uploads/images` | Autenticado; `form-data`, campo `images` (hasta 10 JPG/PNG/WEBP/GIF de 8 MB). |
| POST | `/api/chalets/:id/reviews` | Huésped autenticado (`guestToken`); no puede reseñar su propio chalet. |
| POST | `/api/bookings` | Huésped (`guestToken`). Soporta `bookingType: "cita"` (con `visitTime`) y `"reserva"`. |
| GET | `/api/bookings` | Mis reservas/citas (huésped) o recibidas (anfitrión). Filtros `status`, `chaletId`. |
| GET | `/api/bookings/summary` | Contador de solicitudes pendientes del anfitrión. |
| GET | `/api/bookings/:id` | Huésped de la solicitud, anfitrión o admin. |
| PATCH | `/api/bookings/:id/status` | Anfitrión confirma (`confirmada`) o cancela (`cancelada`); huésped solo cancela. |
| DELETE | `/api/bookings/:id` | Elimina del historial una solicitud ya cancelada/rechazada y emite `booking:deleted`. |
| GET | `/api/messages/eligibility/:userId` | Verifica si existe cita confirmada para chatear (`?chaletId=`). |
| POST | `/api/messages` | Envía mensaje interno en plataforma (`recipientId`, `chaletId`, `content`). |
| GET | `/api/messages/conversations` | Lista todos los chats habilitados por cita aceptada. |
| GET | `/api/messages/with/:userId` | Historial del hilo con otro usuario y marca mensajes como leídos. |
| GET | `/api/messages/unread-count` | Cantidad de mensajes sin leer. |
| GET | `/api/events/stream?ticket=...` | Stream SSE autenticado (también admite `?token=...`). |

## 5. Colección única en `postman/`

Importa el archivo único [TropicStay.postman_collection.json](../postman/TropicStay.postman_collection.json) en Postman:

- **Carpetas 1 a 7 (`01` a `39` + `10` y `32b`)**: secuencia ordenada de principio a fin lista para ejecutar con **Collection Runner**. Registra anfitrión y huésped, emite ticket SSE, consulta catálogos, crea el chalet en MongoDB, cambia sus estados (`reservado`, `mantenimiento`, `disponible`), pide y acepta una cita, prueba el chat interno, crea/confirma/cancela/elimina reservas, publica reseña y limpia el chalet de prueba (desmarca `39` si deseas conservarlo en tu base de datos).
- **Carpeta 8 (Uso Manual)**: recuperación de cuenta en 3 pasos con correo OTP real (`forgot-password`, `verify-reset-code`, `reset-password`), archivo adjunto (`POST /api/uploads/images`), credencial externa (`POST /api/auth/google`) y conexiones persistentes (`GET /api/events/stream`, `GET /api/events/public-stream`).

## 6. Pruebas automáticas de verificación

```powershell
cd server
npm test
npm run test:e2e
npm run test:smoke
```
