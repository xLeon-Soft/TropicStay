# Migración de ubicación y precio en dólares

## Estructura nueva

Cada chalet guarda su ubicación en un arreglo de textos:

```json
"location": [
  "Lago de Atitlán, Sololá",
  "Muelle privado"
]
```

El campo anterior `locationName` se migra y se elimina. El campo `location` también se elimina de todos los usuarios; la ubicación pertenece al chalet, no al perfil del anfitrión.

## Aplicar la migración a MongoDB

Desde la raíz del proyecto ejecuta una sola vez:

```powershell
npm run migrate:locations
```

La migración conserva todos los chalets y usuarios. Convierte `locationName` en un arreglo de un elemento y quita los dos campos obsoletos: `chalets.locationName` y `users.location`.

## API de precio en USD

Consulta la tasa y convierte un precio por noche:

```http
GET http://localhost:5000/api/currency/usd?gtq=2800
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "data": {
    "gtqPerUsd": 7.78,
    "usdPerGtq": 0.128535,
    "amountGTQ": 2800,
    "amountUSD": 359.9
  }
}
```

Al crear o cambiar `pricePerNight`, la API de chalets obtiene esa tasa y asigna automáticamente `priceUSD`; Postman y el frontend ya no deben enviarlo.

Importa [TropicStay_Ubicacion_Moneda.postman_collection.json](../postman/TropicStay_Ubicacion_Moneda.postman_collection.json) para probar ambos casos.
