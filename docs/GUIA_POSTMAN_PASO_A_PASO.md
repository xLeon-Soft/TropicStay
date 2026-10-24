# Pruebas locales de TropicStay con Postman

No envías datos directamente a MongoDB. Envías una petición HTTP a la API de TropicStay; el backend valida los datos y entonces los guarda en MongoDB.

```
Postman  ->  http://localhost:5000/api  ->  Backend Express  ->  MongoDB
```

## Antes de comenzar

Abre dos terminales desde la carpeta raíz del proyecto:

```powershell
# Terminal 1: API y conexión a MongoDB
npm run start:server

# Terminal 2: sitio web Angular
npm run start:client
```

En Postman crea o selecciona un entorno y añade estas variables:

| Variable | Valor inicial | Para qué sirve |
| --- | --- | --- |
| `baseUrl` | `http://localhost:5000/api` | Dirección de la API local. |
| `token` | vacío | Token de tu inicio de sesión. |
| `chaletId` | vacío | ID del chalet que crearás durante la prueba. |
| `bookingId` | vacío | ID de la reserva que crearás durante la prueba. |

En las URLs usa `{{baseUrl}}`, por ejemplo: `{{baseUrl}}/chalets`.

## A. Pruebas sin inicio de sesión

Estas peticiones solo consultan MongoDB; no cambian nada.

### 1. Comprobar que API y base están disponibles

| Campo | Valor |
| --- | --- |
| Método | `GET` |
| URL | `{{baseUrl}}/health` |
| Body | ninguno |

Respuesta esperada:

```json
{ "success": true, "status": "ok", "service": "TropicStay API" }
```

### 2. Consultar todos los chalets

| Campo | Valor |
| --- | --- |
| Método | `GET` |
| URL | `{{baseUrl}}/chalets` |
| Body | ninguno |

La respuesta contiene `data`, una lista de los chalets de MongoDB. Copia el valor `_id` de uno y, si quieres, guárdalo temporalmente en la variable `chaletId`.

### 3. Consultas con filtros

| Qué deseas buscar | Método y URL |
| --- | --- |
| Chalets de Sololá | `GET {{baseUrl}}/chalets?department=Sololá` |
| Chalets para 4 personas o más | `GET {{baseUrl}}/chalets?guests=4` |
| Chalets entre Q1,000 y Q3,000 | `GET {{baseUrl}}/chalets?minPrice=1000&maxPrice=3000` |
| Chalets con piscina y wifi | `GET {{baseUrl}}/chalets?amenities=Piscina%20privada,Wifi%20de%20alta%20velocidad` |
| Ordenar por menor precio | `GET {{baseUrl}}/chalets?sort=price-asc` |
| Buscar Atitlán | `GET {{baseUrl}}/chalets?search=Atitlán` |

### 4. Ver un chalet, sus reseñas y anfitriones

| Método | URL |
| --- | --- |
| `GET` | `{{baseUrl}}/chalets/{{chaletId}}` |
| `GET` | `{{baseUrl}}/chalets/{{chaletId}}/reviews` |
| `GET` | `{{baseUrl}}/chalets/meta/departments` |
| `GET` | `{{baseUrl}}/hosts` |

## B. Obtener el token para operaciones que guardan datos

Para crear chalet, reserva o reseña debes usar la misma sesión que usa la web.

1. Ve a `http://localhost:4200/login` e inicia sesión con Google.
2. Presiona `F12` en el navegador.
3. Abre **Application** → **Session Storage** → `http://localhost:4200`.
4. Abre `tropicstay_google_user` y copia solamente el valor de `token`.
5. Pega ese valor en la variable `token` de Postman.

En cada petición protegida configura:

| Campo | Valor |
| --- | --- |
| Authorization | Tipo `Bearer Token` |
| Token | `{{token}}` |
| Content-Type | `application/json` (salvo carga de imágenes) |

Si recibes `401`, el token no está presente, es inválido o ya venció: vuelve a iniciar sesión y cópialo de nuevo.

## C. Pruebas que escriben en la base de datos

Sigue estas pruebas en este orden. Usan fechas futuras respecto al proyecto y puedes borrar el chalet de prueba al final.

### 5. Crear un chalet — `POST`

| Campo | Valor |
| --- | --- |
| Método | `POST` |
| URL | `{{baseUrl}}/chalets` |
| Authorization | Bearer `{{token}}` |
| Body | raw → JSON |

Pega este body:

```json
{
  "title": "Chalet de prueba Postman",
  "category": "Lago",
  "department": "Sololá",
  "municipality": "Panajachel",
  "location": ["Panajachel, Sololá"],
  "description": "Este chalet existe únicamente para validar la conexión local con MongoDB.",
  "pricePerNight": 1500,
  "deposit": 500,
  "cleaningFee": 150,
  "guestsMax": 4,
  "bedrooms": 2,
  "beds": 3,
  "bathrooms": 2,
  "images": [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200"
  ],
  "thumbnail": "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200",
  "amenities": ["Wifi de alta velocidad", "Piscina privada"],
  "rules": ["No fumar", "No fiestas"]
}
```

Respuesta esperada: `201 Created`. Copia `data._id` y guárdalo en la variable `chaletId`. El documento se habrá guardado en la colección `chalets` y tu usuario quedará como anfitrión.

### 6. Confirmar que quedó guardado — `GET`

| Método | URL |
| --- | --- |
| `GET` | `{{baseUrl}}/chalets/{{chaletId}}` |

Debes ver exactamente los datos enviados en el paso anterior.

### 7. Actualizar el chalet — `PUT`

| Campo | Valor |
| --- | --- |
| Método | `PUT` |
| URL | `{{baseUrl}}/chalets/{{chaletId}}` |
| Authorization | Bearer `{{token}}` |
| Body | raw → JSON |

```json
{
  "pricePerNight": 1650,
  "status": "disponible",
  "amenities": ["Wifi de alta velocidad", "Piscina privada", "Parrilla BBQ"]
}
```

Solo puedes actualizar un chalet creado por tu mismo usuario.

### 8. Crear una reserva — `POST`

| Campo | Valor |
| --- | --- |
| Método | `POST` |
| URL | `{{baseUrl}}/bookings` |
| Authorization | Bearer `{{token}}` |
| Body | raw → JSON |

```json
{
  "chaletId": "{{chaletId}}",
  "guestName": "Tu nombre de prueba",
  "guestEmail": "tu-correo@ejemplo.com",
  "guestPhone": "+50255555555",
  "checkIn": "2026-11-20",
  "checkOut": "2026-11-23",
  "guestsCount": 2,
  "notes": "Reserva local creada desde Postman"
}
```

Respuesta esperada: `201 Created`. Copia `data._id` a la variable `bookingId`. MongoDB guardará la reserva en `bookings`, incluyendo noches, total y usuario asociado.

### 9. Consultar y cancelar una reserva

| Acción | Método | URL | Body |
| --- | --- | --- | --- |
| Ver mis reservas | `GET` | `{{baseUrl}}/bookings` | ninguno |
| Ver una reserva | `GET` | `{{baseUrl}}/bookings/{{bookingId}}` | ninguno |
| Cancelar | `PATCH` | `{{baseUrl}}/bookings/{{bookingId}}/status` | `{ "status": "cancelada" }` |

Todas requieren Bearer `{{token}}`. Si pruebas reservar dos veces las mismas fechas para el mismo chalet, recibirás `409 Conflict`; eso confirma que la validación de solapamiento funciona.

### 10. Crear una reseña — `POST`

| Campo | Valor |
| --- | --- |
| Método | `POST` |
| URL | `{{baseUrl}}/chalets/{{chaletId}}/reviews` |
| Authorization | Bearer `{{token}}` |
| Body | raw → JSON |

```json
{
  "rating": 5,
  "comment": "Reseña de prueba creada desde Postman.",
  "cleanliness": 5,
  "location": 5,
  "communication": 5,
  "value": 5
}
```

El nombre y avatar se toman de tu usuario autenticado; no hace falta enviarlos.

### 11. Subir imágenes desde tu equipo — `POST`

| Campo | Valor |
| --- | --- |
| Método | `POST` |
| URL | `{{baseUrl}}/uploads/images` |
| Authorization | Bearer `{{token}}` |
| Body | `form-data` |

En Body elige `form-data`, crea la clave `images`, cambia el tipo de esa clave de **Text** a **File** y selecciona una imagen. La respuesta devuelve `urls`; usa esas URLs en `images` y `thumbnail` al crear o actualizar un chalet. Máximo 10 imágenes y 8 MB por archivo.

### 12. Borrar el chalet de prueba — `DELETE`

| Campo | Valor |
| --- | --- |
| Método | `DELETE` |
| URL | `{{baseUrl}}/chalets/{{chaletId}}` |
| Authorization | Bearer `{{token}}` |
| Body | ninguno |

Esta es una operación real: elimina el chalet y sus reseñas. Úsala solo al terminar las pruebas con el chalet que creaste.

## Resumen rápido de métodos

| Método | Significado | Ejemplo en TropicStay |
| --- | --- | --- |
| `GET` | Consultar, no modifica datos. | Ver chalets. |
| `POST` | Crear un registro. | Crear chalet, reserva, reseña. |
| `PUT` | Actualizar datos de un registro. | Editar chalet. |
| `PATCH` | Actualizar solo una parte. | Cambiar estado de reserva. |
| `DELETE` | Eliminar un registro. | Borrar chalet propio de prueba. |
