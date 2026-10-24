# Cargar el Chalet Santuario desde Postman

La ruta correcta de los datos es:

```text
Postman -> API Express (localhost:5000) -> MongoDB (tropicstay_db)
```

No se debe pegar la sintaxis de la consola de MongoDB directamente en Postman. Postman envía JSON estándar; el backend convierte los números, genera los campos técnicos y guarda el documento en MongoDB.

## Datos encontrados en la base actual

La API local fue consultada el 17 de octubre de 2026. Ya existen los datos compartidos:

| Dato | Valor |
| --- | --- |
| Chalet Santuario | `6ac730a6390ceb0bf77ce2d2` |
| Anfitriona Sofía Méndez Villagrán | `6ac730a6390ceb0bf77ce2ca` |
| Reseñas del chalet actual | 2 |

Por eso, ejecutar **Crear chalet Santuario** creará una nueva copia del chalet; no modifica la existente. Usa las dos consultas de la carpeta 1 de la colección si solo quieres ver los registros actuales.

## Importar y ejecutar la colección

1. Inicia MongoDB y la API desde la raíz del proyecto:

   ```powershell
   npm run start:server
   ```

2. En Postman elige **Import** y selecciona [TropicStay_Carga_Santuario.postman_collection.json](../postman/TropicStay_Carga_Santuario.postman_collection.json).
3. Abre la colección, entra a **Variables** y pega tu JWT en `token` (Current value).
4. Ejecuta, en este orden, dentro de la carpeta **2. Crear una nueva copia desde Postman**:
   1. `Crear chalet Santuario`
   2. `Crear reseña para el chalet recién creado`
   3. `Confirmar chalet y reseñas guardados`

La primera petición guarda automáticamente el ID que responde el backend en `chaletId`; no tienes que copiarlo a mano.

## Obtener el token obligatorio

Los `POST` de chalets y reseñas están protegidos. La API no permite insertar sin una sesión válida.

1. Abre `http://localhost:4200/login` e inicia sesión con Google.
2. Abre las herramientas de desarrollo del navegador (`F12`).
3. Ve a **Application** -> **Session Storage** -> `http://localhost:4200`.
4. Abre `tropicstay_google_user`, copia solo `token` y pégalo como valor de la variable `token` en Postman.

Si aparece `401`, vuelve a iniciar sesión: el token vence en 8 horas.

## Conversión de tus documentos al JSON de Postman

| Sintaxis de MongoDB | Sintaxis correcta en Postman |
| --- | --- |
| `NumberInt('2800')` | `2800` |
| `Double('4.97')` | `4.97` |
| `ObjectId('...')` | No se envía al crear por API. |
| `ISODate('...')` | No se envía; MongoDB genera fechas. |
| `_id`, `__v`, `createdAt`, `updatedAt` | No se envían; MongoDB/Mongoose los generan. |

## Campos que la API protege

Aunque los documentos de MongoDB incluyen `host`, `authorName`, `authorAvatar` y `date`, no se mandan en las peticiones de creación:

- Al crear un chalet, la API toma `host` del usuario autenticado (`token`). No permite publicar un chalet en nombre de Sofía enviando su ID.
- Al crear una reseña, la API toma el autor y avatar del usuario autenticado y la fecha actual del servidor.
- Después de crear una reseña, la API recalcula `rating`, `reviewsCount` y `ratingBreakdown` del chalet con las reseñas almacenadas.

Esto evita que un cliente pueda suplantar a otro usuario desde Postman. Para que la copia quede asociada exactamente a Sofía o para que la reseña aparezca como Fernando García, debes autenticarte con esas respectivas cuentas de Google. No existe una ruta pública para crear usuarios manualmente, y eso es intencional.

## Verificación final

La última petición devuelve la copia nueva con su `_id`, anfitrión y arreglo `reviews`. También puedes consultar directamente:

```http
GET http://localhost:5000/api/chalets/{{chaletId}}
```

Si la respuesta es `201 Created` al publicar y luego `200 OK` al consultar, los datos ya recorrieron correctamente Postman, backend y MongoDB.
