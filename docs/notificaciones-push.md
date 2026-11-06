# Notificaciones push · XG-0030

## Parte 1: base de datos y seguridad

Migración: `supabase/migrations/20261105140000_base_notificaciones_push.sql`.

Esta parte agrega almacenamiento; todavía no registra teléfonos desde la app,
no crea envíos automáticamente y no contacta Expo. La bandeja y Realtime
existentes continúan funcionando.

### Dispositivos

`dispositivos_push` permite varias instalaciones por usuario. Guarda token Expo,
plataforma, proyecto EAS, entorno y estado activo. Un token solo puede existir
una vez. La aplicación deberá eliminar o desvincular su registro antes de
cambiar de cuenta; no puede apropiarse del dispositivo de otro usuario.

RLS limita lectura, creación, actualización y eliminación al propietario.
El propietario no puede cambiar `usuario_id`, `instalacion_id` ni las fechas
de un registro existente. Los tokens no se publican por Realtime.

### Cola de envíos

`envios_push` admite un envío por notificación y dispositivo. Conserva intentos,
próximo intento, bloqueo temporal del trabajador, ticket Expo y último error.
Solo el backend con `service_role` puede acceder a ella. El futuro trabajador
deberá validar propietario, dispositivo activo, proyecto y entorno antes de
cada envío, incluyendo los reintentos.

Estados: `pendiente`, `procesando`, `enviado`, `confirmado`, `error`, `cancelado`.
`enviado` representará un ticket aceptado por Expo; `confirmado`, un recibo
positivo del proveedor. Ninguno acredita que el usuario haya visto el aviso.
La lectura permanece en `notificaciones.leida`.

La restricción única evita duplicar trabajos en la base de datos; no garantiza
entrega exactamente una vez ante fallos de red del futuro trabajador.

Al borrar un dispositivo o una notificación se eliminan sus trabajos asociados.
Las credenciales del servidor nunca deben incluirse en la aplicación móvil.

### Cómo probar esta parte

1. Aplicar la migración en la base de pruebas usando el procedimiento habitual
   del proyecto. No requiere recompilar la aplicación.
2. Ejecutar `supabase/tests/notificaciones_push.sql` en esa misma base, como
   administrador (por ejemplo, mediante el SQL Editor de Supabase).
3. Deben existir al menos dos registros en `usuarios`. El script comprueba
   aislamiento entre cuentas, permisos, actualización y eliminación propias,
   rechazo de transferencias, acceso del servicio, deduplicación y borrado en
   cascada. Termina con `ROLLBACK`; no conserva los datos de prueba.
4. Abrir la app y comprobar que las reservaciones y la bandeja actual funcionan.

No se espera recibir un push todavía. Las credenciales, registro móvil y envío
se incorporarán en las siguientes partes.

### Validación remota realizada

El 5 de noviembre de 2026 se aplicó la migración al proyecto vinculado
`ximbalgo` (`hjtaifvwshwjmzlhortg`, entorno identificado por CLI: producción),
con autorización del propietario.

- `npx supabase db push --remote --dry-run`: únicamente estaba pendiente esta migración.
- `npx supabase db push --remote --yes`: migración aplicada correctamente.
- `npx supabase db query --remote --yes --file supabase/tests/notificaciones_push.sql`:
  prueba completada sin errores; los datos temporales se revirtieron con `ROLLBACK`.
- Verificación final con `db push --remote --dry-run`: base al día, sin migraciones pendientes.

Se verificaron el aislamiento entre cuentas, los permisos de las tablas, la
actualización y eliminación por el propietario, el rechazo de transferencias,
la inserción desde `service_role`, la deduplicación y el borrado en cascada.
Esto valida la base de datos; todavía no acredita recepción push en teléfonos.
