# Animaciones del cliente

`src/components/AnimacionEstado.tsx` centraliza siete Lotties locales, creados para el proyecto con los colores de la app. No requieren descargas ni dependencias nuevas.

- `cargando`: puntos animados en bucle, de 72 × 72. Se usa en Inicio, los selectores de origen y destino, rutas, taxis, paraderos, perfil, notificaciones y reservaciones.
- `reservaciones`: maleta de 112 × 112 para las listas de reservaciones vacías, tanto en curso como historial. Se reproduce en bucle mientras la pantalla está activa.
- `notificaciones`: campana de 112 × 112 para las notificaciones vacías. Se reproduce en bucle mientras la pantalla está activa.

Las animaciones son decorativas y conservan los mensajes y acciones de cada pantalla. Se pausan cuando la pantalla pierde el foco o la aplicación pasa al fondo. Con reducir movimiento activado se muestra una ilustración estática.

En Inicio, `viajero` representa una persona caminando con su maleta junto al título «Tu viaje», con un tamaño de 64 × 64. `taxi` aparece cuando no hay taxis cercanos y `ubicacion` muestra un marcador animado cuando no hay paraderos cercanos. Las tres se reproducen en bucle. `EstadoLista` permite elegir una ilustración vacía mediante la propiedad opcional `animacionVacio`; los errores conservan su mensaje y la acción de reintentar.

Los archivos se encuentran en `assets/lotties/cliente-*.json`. Para sustituirlos, conserva los nombres o actualiza las importaciones de `AnimacionEstado.tsx`.

## Revisión visual pendiente

En Android e iOS, abrir las pantallas con una conexión lenta para observar las cargas. Revisar reservaciones sin viajes en ambas pestañas y una cuenta sin notificaciones. Comprobar los enlaces para reservar y reintentar, cambiar de pantalla y volver, enviar la app al fondo y activar reducir movimiento en los ajustes del sistema. Las animaciones deben detenerse sin ocultar los textos ni las acciones.

En ?Yo?, `compartirUbicacion` acompa?a la tarjeta para compartir ubicaci?n: el marcador azul emite ondas verdes solo cuando existe una sesi?n compartida. Antes de iniciar y despu?s de detenerla se muestra est?tico, sin ondas. La propiedad `animar` permite controlar este comportamiento sin alterar las dem?s animaciones. Conserva las pausas por foco, segundo plano y reducir movimiento. Revisar tambi?n inicio fallido, detener y expiraci?n de la sesi?n.
