# Desplegar el buzón financiero

Este backend es necesario para que el Atajo de iOS pueda registrar movimientos sin abrir Safari ni la PWA.

## Opción preparada: Cloudflare Worker + KV

1. Instala Wrangler e inicia sesión en tu cuenta de Cloudflare.
2. Desde la carpeta `backend`, copia `wrangler.toml.example` como `wrangler.toml`.
3. Crea un namespace KV y coloca su ID en `wrangler.toml` bajo el binding `FINANCE_INBOX`.
4. Define una clave privada fuerte como secreto `FINANCE_TOKEN`.
5. Despliega el Worker.
6. Copia la URL HTTPS resultante y pégala en Flor Morado → Finanzas → Atajo iOS.
7. Escribe la misma clave privada en la app y en el encabezado Authorization del Atajo.

La app nunca necesita la cuenta de Cloudflare: solo la URL HTTPS y la clave privada.

## Contrato HTTP

### Crear movimiento desde Atajos
`POST /`

Encabezados:
- `Authorization: Bearer TU_CLAVE`
- `Content-Type: application/json`

Cuerpo:
```json
{
  "type": "expense",
  "amount": 85000,
  "accountName": "Nequi",
  "category": "Transporte",
  "note": "Flete comedor"
}
```

### Leer pendientes desde Flor Morado
`GET /` con el mismo encabezado Authorization.

### Confirmar importados
`PATCH /` con:
```json
{"ack":["ID_DEL_MOVIMIENTO"]}
```

Los movimientos confirmados se conservan temporalmente para trazabilidad y después pueden expirar.
