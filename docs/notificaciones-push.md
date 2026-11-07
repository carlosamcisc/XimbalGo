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

## Parte 2: registro del teléfono

Se instalaron `expo-notifications`, `expo-constants` y `expo-crypto` con
`expo install` para SDK 57. Se configuraron el icono monocromático, el permiso
Android y el canal `reservas`. El perfil `development-device` permite generar
una compilación de desarrollo para iPhone físico sin cambiar los perfiles de
simulador existentes.

Al restaurar una sesión de cliente o taxista, la app consulta el permiso y
explica los avisos antes de solicitarlo por primera vez. «Ahora no» no vuelve
a mostrar la explicación; posteriormente se puede habilitar el permiso desde
los ajustes del sistema. La pantalla de preferencias se incorpora en la parte 5.
Rechazar el permiso no impide usar las reservaciones ni la bandeja existente.

Con permiso concedido (o provisional en iOS), se registra el token Expo con
un UUID de instalación persistido en AsyncStorage. Se vuelve a sincronizar al
regresar del segundo plano y cuando cambia el token nativo. Si falla la red,
la app informa del fallo y reintenta al volver al primer plano.

Las escrituras se serializan. Cerrar sesión invalida registros pendientes y
elimina el dispositivo antes de cerrar la sesión de Supabase; si no puede
confirmarse la desvinculación, conserva la sesión e informa que hay que
reintentar. Esto evita dejar el teléfono registrado deliberadamente en una
cuenta anterior. La recuperación de contraseña no activa el registro push.
La revocación del permiso desde Ajustes se refleja al volver a la app.

### Configuración y credenciales

- Cada perfil EAS fija `EXPO_PUBLIC_PUSH_ENVIRONMENT`. Localmente el valor
  predeterminado es `development`; se serializa como `extra.pushEnvironment`.
- El proyecto EAS se obtiene de la configuración existente de Ximbal Go.
- Android requiere un proyecto Firebase con la aplicación
  `com.carlosmay.ximbalgo`. Definir `GOOGLE_SERVICES_JSON` con la ruta al
  archivo `google-services.json` (o como variable de tipo File en EAS).
  `app.config.ts` lo usa como `android.googleServicesFile`.
- Las credenciales FCM v1 del servicio de envío y la clave APNs de iOS deben
  configurarse en el proyecto EAS. La cuenta de servicio de Firebase y las
  claves de Apple nunca se incluyen en JavaScript ni en el repositorio.
- La instalación de dependencias no crea estas credenciales. El 6 de noviembre
  de 2026 se incorporó localmente `google-services.json` con el paquete
  `com.carlosmay.ximbalgo` y se definió `GOOGLE_SERVICES_JSON` en `.env`.
  Ambos archivos permanecen fuera de Git. También se actualizó el identificador
  iOS en `app.json`. No se ha verificado la configuración remota de credenciales
  EAS ni la recepción en un teléfono. Para EAS Build se debe configurar también
  la variable File `GOOGLE_SERVICES_JSON` en el entorno de la compilación.

### Cómo probar esta parte

1. Preparar las credenciales anteriores y generar una **nueva compilación
   nativa**. Una actualización de Metro sobre la compilación anterior no
   incorpora los módulos nuevos. Ejemplos:
   `npx eas-cli build --platform android --profile development`, o para iPhone,
   `npx eas-cli build --platform ios --profile development-device`.
2. Instalarla, iniciar sesión como cliente o taxista, pulsar «Continuar» y
   conceder el permiso del sistema. Comprobar en Supabase que existe un
   registro propio en `dispositivos_push`, con proyecto y entorno correctos.
3. Reabrir la app: debe actualizar el registro existente, sin duplicarlo.
4. Cerrar sesión con conexión: el registro de esa instalación debe desaparecer.
   Entrar con otra cuenta: debe pertenecer únicamente a la cuenta nueva.
5. Revocar el permiso en Ajustes y regresar: debe eliminarse el registro.
   Habilitarlo y regresar: debe registrarse otra vez.
6. Sin conexión, las reservaciones siguen mostrando su manejo habitual de
   errores y el registro push podrá reintentarse al regresar. Cerrar sesión
   requiere poder confirmar la desvinculación si ya había una instalación.

Esta parte no crea envíos ni maneja la navegación al tocar un aviso. No se
requieren migraciones nuevas. La prueba SQL de la parte 1 se volvió a ejecutar
correctamente sobre el proyecto vinculado con reversión de sus datos.

Validación automatizada de esta parte: `npm run typecheck` y las 64 pruebas de
`npm test` completadas correctamente, incluyendo 15 casos nuevos de registro,
permisos y ciclo de vida. La introspección nativa verificó el permiso Android,
el canal FCM, el entitlement APNs de iOS y el entorno serializado.

Fuentes: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
y [configuración de push de Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/).
