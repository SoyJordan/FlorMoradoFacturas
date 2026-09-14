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


## V1.4.5
- Integración iOS para Finanzas mediante un único Atajo “Movimiento Flor Morado”.
- Ruta rápida dinámica `?quick=finance` que abre el formulario financiero simplificado.
- En modo rápido solo permite Ingreso o Gasto y guarda en el historial financiero existente.
- Botón “Atajo iOS” dentro de Finanzas con enlace dinámico, copia al portapapeles, acceso a Atajos y prueba integrada.
- Conserva hora de Colombia y compatibilidad con los datos existentes.
