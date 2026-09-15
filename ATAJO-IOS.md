# Atajo iOS · Movimiento Flor Morado

La V1.4.6 ya no abre Safari. El Atajo debe usar **Obtener contenido de URL** para enviar un POST JSON al buzón financiero.

## Flujo del Atajo
1. Elegir de menú: `Ingreso` o `Gasto`.
2. Pedir número: valor.
3. Elegir/escribir la cuenta exactamente como aparece en Finanzas (por ejemplo `Nequi`).
4. Pedir categoría.
5. Pedir concepto/nota (opcional).
6. Acción **Obtener contenido de URL**:
   - URL: la URL HTTPS del Worker.
   - Método: `POST`.
   - Cuerpo de solicitud: `JSON`.
   - Campos: `type`, `amount`, `accountName`, `category`, `note`.
   - Encabezado: `Authorization` = `Bearer TU_CLAVE_PRIVADA`.
7. Mostrar notificación: `Movimiento enviado a Flor Morado`.

Valores de `type`: `income` para ingreso y `expense` para gasto.

## Ejemplo JSON
```json
{
  "type": "expense",
  "amount": 85000,
  "accountName": "Nequi",
  "category": "Transporte",
  "note": "Flete comedor"
}
```

La app importa el movimiento al abrirse o al tocar **Finanzas → Atajo iOS → Sincronizar ahora**.
