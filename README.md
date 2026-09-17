
## V1.4.7 · PDF compatible con iPhone/PWA

- Reemplaza `window.print()` por generación local de un archivo PDF real.
- En iPhone/iPad usa la hoja nativa de compartir cuando el navegador permite compartir archivos PDF.
- Fallback de descarga/apertura para navegadores sin Web Share de archivos.
- No modifica ventas, clientes, inventario, Finanzas ni el buzón de Atajos.

# Flor Morado Muebles

## V1.4.4 — Código organizado

Estructura del proyecto:

- `index.html`: únicamente estructura y contenido HTML.
- `css/styles.css`: todos los estilos visuales y responsive.
- `js/app.js`: toda la lógica de negocio e interacción.
- `assets/`: logo e iconos de la PWA.
- `manifest.json`: configuración de instalación PWA.
- `sw.js`: caché y funcionamiento offline.

### Cambios heredados de V1.4.3

- Fecha de negocio fijada a `America/Bogota`.
- Movimientos ordenados por día y hora.
- Movimientos nuevos guardan hora exacta.
- Historial antiguo permanece compatible.

### Compatibilidad de datos

La clave de almacenamiento sigue siendo `florMoradoDB_v1`, por lo que esta reorganización de archivos no cambia ni reinicia los datos guardados en el navegador.


## V1.4.7
- Integración iOS para Finanzas mediante un único Atajo “Movimiento Flor Morado”.
- Ruta rápida dinámica `?quick=finance` que abre el formulario financiero simplificado.
- En modo rápido solo permite Ingreso o Gasto y guarda en el historial financiero existente.
- Botón “Atajo iOS” dentro de Finanzas con enlace dinámico, copia al portapapeles, acceso a Atajos y prueba integrada.
- Conserva hora de Colombia y compatibilidad con los datos existentes.


## V1.4.7 · Atajo iOS sin Safari
- Se retiró el acceso rápido basado en URL que abría Safari.
- Nuevo buzón financiero remoto para Atajos de iOS mediante POST JSON autenticado.
- Finanzas importa ingresos/gastos al abrir la app, al recuperar conexión o al tocar “Sincronizar ahora”.
- Los movimientos sincronizados usan `syncId` para evitar duplicados.
- La cuenta se resuelve por nombre exacto y el saldo se calcula con la misma lógica del módulo Finanzas.
- Se incluye `backend/worker.js`, `backend/wrangler.toml.example` y `ATAJO-IOS.md`.

> Requisito: desplegar el backend incluido y configurar su URL HTTPS + clave privada dentro de Finanzas. Sin un endpoint remoto, iOS no puede escribir en el almacenamiento privado de una PWA cerrada.
