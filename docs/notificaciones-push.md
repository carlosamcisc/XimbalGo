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

### Corrección del canal Android y la renovación de tokens

El 7 de noviembre de 2026 se corrigieron dos problemas detectados al probar la
compilación Android. El canal omitirá `sound` para usar el sonido del sistema:
el SDK instalado interpretaba `sound: "default"` como un archivo personalizado
inexistente. El listener también reutiliza el token nativo recibido al pedir
el token Expo, evitando que otra consulta nativa dispare el listener en bucle.

La corrección es de JavaScript: basta con recargar la aplicación conectada a
Metro. No requiere regenerar Android ni aplicar migraciones. Se conserva el
canal `reservas` y los ajustes de notificación elegidos por el usuario.

## Parte 3: envío desde Supabase

### Implementación

Cada INSERT en `notificaciones` crea un trabajo por dispositivo activo del
destinatario. Esto aprovecha los eventos existentes de solicitudes, respuestas,
ofertas, cancelaciones, abordaje y finalización para clientes y taxistas. Los
registros antiguos no se encolan al registrar un teléfono nuevo. «Taxi llegando»
se incorporó después según [taxi-llegando.md](./taxi-llegando.md). Los
recordatorios de viajes programados siguen pendientes.

El trabajo conserva token, proyecto y entorno originales. Si cambia el destino
o se desactiva el dispositivo, se cancelan sus trabajos pendientes. El backend
valida nuevamente el destinatario y el destino antes de reclamar cada lote.

`reclamar_envios_push` usa bloqueos con `SKIP LOCKED`, un identificador aleatorio
por reclamación y una concesión de dos minutos. Una ejecución anterior no puede
resolver un trabajo que ya fue retomado. Solo `service_role` puede reclamar o
resolver trabajos; los usuarios de la app no pueden activar el servicio.

La Edge Function `enviar-notificaciones`:

- Procesa hasta 50 envíos y 50 recibos por entorno y ejecución.
- Consulta exclusivamente el proyecto y los entornos configurados en el servidor.
- Envía lotes a Expo, conserva tickets y consulta recibos a partir de 15 minutos.
- Reintenta errores temporales con espera exponencial, con hasta seis intentos
  de envío. No manda avisos con más de dos horas y limita el TTL restante.
- Espera hasta 24 consultas de recibo; un recibo ausente o un fallo de red al
  consultarlo no provoca por sí solo un nuevo envío del mensaje.
- Desactiva tokens `DeviceNotRegistered` y cancela sus trabajos. Un recibo de
  un token antiguo no puede desactivar el token nuevo.
- Rechaza payloads superiores a 4096 bytes sin bloquear los otros trabajos.
- No acepta mensajes ni destinatarios desde el cuerpo HTTP y no registra tokens
  ni contenidos en sus respuestas o errores.

Un corte de red después de que Expo acepte un envío puede dejar al servidor sin
su ticket. El reintento podría duplicar ese aviso; no se promete entrega
exactamente una vez. Un recibo confirmado indica aceptación por el proveedor,
no que la persona haya visto o leído el mensaje.

### Migraciones y validación

Migraciones de esta parte:

- `20261107120000_procesador_notificaciones_push.sql`.
- `20261107121000_programacion_notificaciones_push.sql`.
- `20261107122000_orden_bloqueos_recibos_push.sql`.

Se probaron las migraciones y los scripts SQL en transacciones revertidas antes
de aplicarlas al proyecto vinculado `ximbalgo` (producción). Se verificó que la
primera prueba no dejó el esquema creado antes de la aplicación definitiva.
Se incluyeron pruebas de bloqueo vencido, aislamiento por entorno, protección
de destinatarios, backoff, recibos, rotación e invalidación de tokens y límites
de intentos. Las pruebas usan dispositivos ficticios y no contactan Expo.

El 7 de noviembre de 2026 quedaron aplicadas las tres migraciones. La
verificación final informó que la base está al día y confirmó el cron con
`active=false`, ejecutado por `postgres`. Pasaron `npm run typecheck`, las 94
pruebas de `npm test` (28 del procesador nuevo), `deno check` y los dos scripts
SQL de push sobre la base migrada. Los datos de prueba se revirtieron.

Comandos de verificación:

```sh
npm run typecheck
npm test
npx deno check supabase/functions/enviar-notificaciones/index.ts
npx supabase db query --remote --yes --file supabase/tests/notificaciones_push.sql
npx supabase db query --remote --yes --file supabase/tests/procesador_notificaciones_push.sql
npx supabase db push --remote --dry-run
```

### Despliegue y activación

El 7 de noviembre de 2026, con autorización explícita del propietario, se
desplegó `enviar-notificaciones`, se configuraron los secretos internos y Vault,
y se activó el cron cada minuto. El servicio quedó con `PUSH_ENABLED=true`,
el proyecto EAS de Ximbal Go y **solo `PUSH_ENVIRONMENTS=development`**.
Durante la validación los cambios se mantuvieron sin commit ni push hasta la
autorización del propietario para versionar y subir la rama.

Se verificó HTTP 401 sin clave, HTTP 200 con la clave correcta y HTTP 200
desde `invocar_procesador_push()` usando Vault y `pg_net`, sin errores ni
timeout. Se confirmó también una ejecución automática del cron con estado
`succeeded` y respuesta HTTP 200. La prueba real detectó que era necesario especificar los headers
`Content-Profile: public` y `Accept-Profile: public` para acceder a las RPC;
el adaptador ya los incluye y tiene una prueba de regresión. Los errores de
backend solo exponen un código controlado a invocaciones autorizadas.

La última comprobación automatizada pasó las 96 pruebas y `deno check`.
No había dispositivos activos registrados al realizar la comprobación remota:
no se enviaron avisos a teléfonos ni se verificaron aún FCM/APNs de extremo a
extremo. Abrir la app, iniciar sesión y conceder el permiso antes de probar
los eventos de reserva indicados más abajo.

Procedimiento de configuración y activación (conservar para futuros despliegues):

1. Configurar los secretos del servidor usando como referencia
   `supabase/functions/enviar-notificaciones/.env.example`. Empezar con
   `PUSH_ENABLED=false`, `PUSH_PROJECT_ID` del proyecto EAS y
   `PUSH_ENVIRONMENTS=development` para las pruebas de la app actual.
   `PUSH_WORKER_SECRET` debe ser aleatorio y tener al menos 32 caracteres.
   Si Expo Push tiene seguridad adicional activada, configurar `EXPO_ACCESS_TOKEN`.
   No añadir estas claves a `.env` de la app ni a variables `EXPO_PUBLIC_*`.
2. Desplegar con `npx supabase functions deploy enviar-notificaciones`. El
   `verify_jwt=false` del TOML es intencional: se valida una clave interna
   independiente en `Authorization`, no un JWT del cliente.
3. En Vault, guardar `push_worker_url` con
   `https://hjtaifvwshwjmzlhortg.supabase.co/functions/v1/enviar-notificaciones`
   y `push_worker_secret` con la misma clave interna. No imprimir los secretos.
4. Verificar que el endpoint rechaza una llamada sin autorización y que una
   llamada autorizada responde `habilitado: false`. No debe reclamar trabajos.
5. Verificar las credenciales FCM v1/APNs de EAS y los tokens de prueba. Cambiar
   `PUSH_ENABLED=true` y ejecutar `supabase/ops/activar_notificaciones_push.sql`.
   El cron invocará la función cada minuto; los trabajos recientes que ya estén
   en cola pueden enviarse al activarlo.
6. Inspeccionar el estado sin exponer tokens con
   `supabase/ops/estado_notificaciones_push.sql`. Para pausar futuras ejecuciones,
   ejecutar `supabase/ops/pausar_notificaciones_push.sql`. Una ejecución ya
   iniciada puede terminar su lote; `PUSH_ENABLED=false` bloquea nuevas llamadas.

Las modificaciones de secretos se realizan mediante un archivo fuera del
repositorio o los paneles administrativos; no escribir claves en scripts
versionados ni en comandos que puedan mostrarlas en los logs.

### Prueba en teléfonos después de activar

Usar dos instalaciones, una cliente y otra taxista, con permiso concedido,
dispositivos activos y el entorno incluido en `PUSH_ENVIRONMENTS`:

1. Mandar la app del taxista al segundo plano y crear una reserva desde el cliente.
   El taxista debe recibir «Nueva solicitud de reserva».
2. Mandar la app del cliente al segundo plano y aceptar la reserva desde el taxista.
   El cliente debe recibir «Reserva aceptada».
3. Repetir con oferta de asientos, rechazo y cancelación. Comprobar el destinatario
   correcto y que los dispositivos de cuentas ajenas no reciban el aviso.
4. Comprobar `enviado` en la cola y, tras la consulta de recibos, `confirmado`
   o el código del error. El cron puede añadir hasta un minuto de espera antes
   de contactar Expo; no se garantiza un tiempo de entrega del sistema operativo.

No hace falta recompilar por estos cambios de servidor. La navegación al tocar
el aviso corresponde a la parte 4. La presentación en primer plano se incorporó
durante la comprobación de la aceptación descrita más abajo.

### Diagnóstico de la primera prueba en teléfonos

La comprobación remota posterior encontró un dispositivo activo de cliente y
otro de taxista, ambos en `development`. Los avisos de reserva se generaron y
el cron respondió HTTP 200, pero cuatro trabajos terminaron con
`ultimo_error=InvalidCredentials`, devuelto por Expo.

El archivo Android corresponde a Firebase `ximbalgo-d54ba`, número
`1019460582191`, paquete `com.carlosmay.ximbalgo`. El registro del teléfono
funciona. La inspección con `eas credentials --platform android`, perfil
`development`, confirmó «No credentials set up yet!» para este paquete y que
no existen Google Service Account Keys guardadas en la cuenta para reutilizar.
Falta cargar la credencial de envío FCM v1 del mismo proyecto en Expo EAS.
`google-services.json` configura la app Android, mientras
que el JSON de cuenta de servicio permite enviar desde Expo a Firebase.

Para obtener la clave, abrir Firebase Console > proyecto `ximbalgo-d54ba` >
Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada.
Guardar el JSON fuera del repositorio. Después cargarlo en EAS para el paquete
`com.carlosmay.ximbalgo`, en Google Service Account > Push Notifications (FCM V1).
No debe configurarse como credencial de Play Store ni incluirse en la app.

Referencia: [credenciales FCM v1 de Expo](https://docs.expo.dev/push-notifications/fcm-credentials/).

Una vez corregida la credencial, probar con una reserva nueva. Los trabajos
que quedaron en `error` no se reenvían automáticamente por un cambio de
credenciales. No se desactivaron los dispositivos por este error.

La clave proporcionada posteriormente por el propietario se validó como
cuenta de servicio del proyecto `ximbalgo-d54ba`, se cargó en EAS y quedó
asociada a `com.carlosmay.ximbalgo` para **FCM v1**. El archivo privado se
leyó desde su ubicación externa; no se copió al repositorio.

Se generó un aviso de prueba por cada una de las dos cuentas Android activas
de development, con los títulos «Prueba push: cliente» y «Prueba push: taxista».
Ambos obtuvieron ticket de Expo y quedaron inicialmente en `enviado`, sin
`InvalidCredentials`. No se alteraron reservas ni se reenviaron los cuatro
avisos anteriores fallidos.

La consulta de recibos dejó ambos trabajos en `confirmado`, sin errores, y el
propietario confirmó «Llegaron a ambos» en los teléfonos con la app en segundo
plano. Queda validado el envío real para cliente y taxista. No fue necesario
recompilar. Esta validación se realizó antes de autorizar los commits y el push.

### Comprobación de la aceptación y presentación con la app abierta

Después de corregir FCM v1, la solicitud real llegó al taxista, pero el
propietario informó que la aceptación no apareció en el teléfono del cliente,
que estaba en segundo plano o bloqueado. Se verificó que el aviso de aceptación
sí se creó para el cliente, se envió unos 32 segundos después de aceptar y
obtuvo recibo `confirmado`, sin errores. Este recibo no acredita la presentación
en pantalla; el caso reportado en segundo plano requiere comprobación en el
teléfono y no se atribuye automáticamente al manejador de primer plano.

Se encontró además que faltaba `setNotificationHandler` para mostrar avisos
si la app está abierta al llegar el push. Se añadió `presentacionPush.ts` al
arranque de `index.ts`, antes de montar pantallas o cargar fuentes. Habilita
banner, lista y sonido para Android e iOS. Esto cubre también el caso en que
el cliente vuelve a la app mientras el cron todavía está procesando el aviso.
No modifica el canal ni las preferencias del sistema.

Pasaron TypeScript y las 97 pruebas, incluida la integración del manejador al
arranque. Basta recargar desde Metro; no requiere recompilar ni migraciones.
La navegación al tocar el aviso sigue pendiente de la parte 4.

Se repitió una prueba controlada con el mismo tipo `reserva_aceptada` y la
misma reserva: después de que el propietario confirmara el teléfono del cliente
bloqueado, se creó «Prueba: reserva aceptada» y se procesó inmediatamente la
cola. El propietario confirmó «Sí, apareció bloqueado». La recepción de la
aceptación con el cliente bloqueado quedó comprobada. No se modificó el estado
de la reserva. La causa exacta de la falta de presentación del primer aviso
no se pudo reproducir; no se afirma que fuera un fallo del servidor ni se
atribuye a primer plano contra lo reportado por el propietario.

## Cierre de esta entrega

Con autorización del propietario para crear commits y subir la rama, se
verificó de nuevo que la base vinculada está al día: las migraciones de las
partes 1 y 3 ya están aplicadas y no fue necesario repetirlas. Pasaron
TypeScript, Deno, las 97 pruebas automatizadas y ambos scripts SQL de push.
La prueba de borrado en cascada quedó aislada al dispositivo ficticio para
permitir ejecutarla también cuando ya existen teléfonos reales registrados.

Esta entrega inicial incluyó registro de dispositivos, envío programado,
recibos y presentación en primer plano. Posteriormente se incorporó el aviso
[«taxi llegando»](./taxi-llegando.md), con detección a 150 metros, una sola vez
por reserva, y validación de vigencia antes del envío.

## Parte 4: abrir la reserva al tocar un push

Al tocar el aviso del sistema, el cliente abre `ClienteReserva` y el taxista
abre la nueva pantalla `TaxistaReserva`, con los detalles y las mismas acciones
disponibles en «Mis viajes». Recibir el aviso sin tocarlo conserva la pantalla
actual; la presentación en primer plano sigue usando el manejador existente.

El listener se instala antes de terminar de cargar las fuentes. Consulta
también la última respuesta nativa para recuperar el toque que inició la app
cerrada. La intención espera a que estén listos la sesión, el rol y su navegador;
no interrumpe la recuperación de contraseña. Si el toque ya estaba vinculado
a una cuenta y se cierra esa sesión o cambia la cuenta, se descarta. Los
navegadores también se reinician al cambiar de usuario.

Se validan los UUID y el tipo de aviso. La app consulta `notificaciones` con
el ID recibido y el propietario activo, bajo RLS. El destino se obtiene de
esa fila, sin confiar en el `reservaId` ni en URLs del payload. Si el aviso
se eliminó, pertenece a otra cuenta o ya no tiene reserva, se informa al usuario.
Las pantallas vuelven a consultar el estado actual de la reserva; un aviso
antiguo puede abrir un viaje ya cancelado o completado.

El mismo toque recibido por la consulta inicial y por el listener se procesa
una vez. Si llegan varios toques mientras se consulta Supabase, se conserva
el último. Se limpia la respuesta nativa al consumirla para evitar volver a
abrirla al recargar. Un fallo de conexión ofrece «Reintentar». Abrir la reserva
marca únicamente ese aviso propio como leído; un fallo de esa escritura se
informa sin impedir la navegación. Esto no modifica los recibos del proveedor.

Las pantallas se identifican por reserva y actualizan sus datos al recibir
otro aviso o recuperar el foco. Las consultas tardías se descartan. El detalle
y los paneles del taxista se ocultan cuando su pantalla deja de estar enfocada,
para que un panel previo no tape la reserva abierta desde el push.

### Migración y validación

`20261107140000_abrir_reserva_desde_push.sql` agrega
`obtener_reserva_taxista(p_reserva_id)`. Solo devuelve la reserva asignada a
`auth.uid()`, mantiene la ocultación del teléfono del cliente en viajes cerrados
y permite consultar viajes que quedaron fuera del límite de 200 de la lista.
No altera la función de listado ni las reglas de envío de push.

El 7 de noviembre de 2026 se probó la migración junto con
`supabase/tests/abrir_reserva_desde_push.sql` dentro de una transacción con
`ROLLBACK`. Se comprobó que la función no quedó creada por esa prueba; después
se aplicó al proyecto vinculado `ximbalgo` y se repitió el script sobre el
esquema aplicado. La comprobación final informó la base al día.

La prueba SQL crea más de 200 viajes sintéticos y comprueba la consulta puntual,
el aislamiento entre cliente, taxista, otra cuenta y una sesión sin usuario,
las reservas inexistentes, la lectura del aviso propio y el teléfono oculto
en el historial. Todo se revierte, sin conservar datos ni enviar esos avisos.

Pasaron `npm run typecheck` y las 118 pruebas de `npm test`, incluidas 21 nuevas
de apertura, sesión, deduplicación, errores de red, filtros del repositorio,
integración con el listener y actualización de ambos detalles. La recepción
y la navegación reales en teléfonos quedan pendientes de la prueba siguiente.
El propietario autorizó crear los commits y subir esta parte en la rama
`feature/XG-0030-notificaciones-push`. Antes de versionarla se confirmó de nuevo
que la base vinculada está al día, sin migraciones pendientes.

```sh
npm run typecheck
npm test
npx supabase db query --remote --yes --file supabase/tests/abrir_reserva_desde_push.sql
npx supabase db push --remote --dry-run
```

### Prueba en teléfonos

No se agregaron dependencias ni configuración nativa: basta recargar ambas
apps desde Metro. No es necesario regenerar Android ni volver a desplegar
la Edge Function.

1. Con el taxista en segundo plano, crear una solicitud desde el cliente.
   Tocar «Nueva solicitud de reserva»: debe abrir el detalle de ese viaje,
   permitir responder y regresar con la flecha o el botón Atrás del sistema.
2. Aceptar desde el taxista con el cliente bloqueado. Tocar «Reserva aceptada»:
   debe abrir esa reserva y su seguimiento. Repetir con «Taxi llegando» cuando
   se pueda hacer la prueba de aproximación pendiente.
3. Repetir tocando un banner con la app abierta y un aviso con la app cerrada
   desde recientes. Con Metro, mantener el servidor accesible al teléfono.
4. Abrir un segundo aviso de la misma reserva: debe actualizar el estado sin
   añadir otra pantalla de esa reserva. Recibirlo sin tocarlo no debe navegar.
5. Tocar un aviso de una reserva que posteriormente se canceló o completó:
   debe mostrar el estado actual y sus acciones vigentes.
6. Sin conexión, tocar un aviso; restablecer la conexión y pulsar «Reintentar».
   Comprobar también el botón de reintento del detalle si falla su consulta.
7. Con un aviso anterior aún visible en el sistema, cerrar sesión y entrar con
   otra cuenta. Al tocarlo no debe abrir datos de la cuenta anterior.

Referencia de las APIs de respuesta y del listener:
[Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
La parte 5 (preferencias y bandeja del taxista) se describe a continuación.

## Parte 5: preferencias y bandeja del taxista

### Acceso y comportamiento

Ambos roles tienen bandeja de notificaciones con actualización Realtime,
recarga al volver al primer plano, reintento y lectura individual o de todos
los avisos propios. Se muestran los 50 más recientes, ordenados por fecha e ID;
el contador incluye **todos** los avisos sin leer, también los anteriores a
esos 50. Tocar un aviso abre el detalle correspondiente usando las rutas de
la parte 4; si ya no tiene reserva, se informa en pantalla.

El cliente conserva la entrada «Notificaciones» del menú lateral. El taxista
tiene una entrada en Inicio y otra en Perfil, ambas con el total sin leer.
La consulta de la bandeja es independiente de la carga del perfil y de los
viajes: un fallo al obtener avisos no bloquea esas funciones. Las consultas
tardías de una sesión anterior se descartan y se retiran sus listeners.

El engranaje de ambas bandejas abre «Preferencias de avisos». El taxista
también puede entrar directamente desde Perfil. La pantalla distingue:

- **Permiso de este teléfono:** permite consultar su estado, pedirlo mediante
  «Activar notificaciones», abrir los ajustes del sistema o volver a sincronizar
  el registro. La solicitud explícita permite reconsiderar «Ahora no» de la
  explicación inicial. Un permiso bloqueado se cambia desde Ajustes; un permiso
  provisional de iOS se identifica como tal.
- **Preferencias de la cuenta:** un interruptor general silencia o activa los
  push de todos sus teléfonos. «Reservas» controla solicitudes, respuestas,
  cancelaciones y ofertas. El cliente dispone además de «Taxi llegando» y
  «Avance del viaje» (abordaje y finalización). Se muestran las categorías que
  reciben los eventos actuales de cada rol.

Los cambios de preferencias se guardan en Supabase. La pantalla espera la
confirmación del servidor y bloquea cambios simultáneos; si falla la petición,
informa y vuelve a consultar el estado real. Solo se modifica el campo elegido,
conservando elecciones hechas desde otro teléfono. El usuario esperado también
se valida en la RPC para evitar aplicar una acción pendiente a una cuenta nueva.
Las elecciones se actualizan al volver a la pantalla o al primer plano.

### Aplicación en el servidor

Migración: `20261107150000_preferencias_notificaciones.sql`.

`preferencias_notificaciones` guarda una fila por usuario. RLS permite leer,
crear y modificar únicamente la propia; la app no puede transferirla a otra
cuenta. La RPC `guardar_preferencia_push` conserva RLS (`security invoker`) y
valida usuario, campo y valor. Sin fila, todas las categorías permanecen activas,
por lo que la migración conserva el comportamiento de las cuentas existentes.

Silenciar los push no borra avisos ni desactiva tokens. El productor deja de
encolar las categorías silenciadas y cancela sus trabajos `pendiente` o
`procesando` en todos los dispositivos y entornos de esa cuenta. La reclamación
vuelve a validar las preferencias, incluidos los reintentos y las inserciones
administrativas. Los recibos de avisos ya enviados se siguen consultando.
Reactivar no reenvía los avisos antiguos ni revive trabajos cancelados.

Un aviso que ya estaba en tránsito hacia Expo o el sistema operativo puede
aparecer después de silenciarlo: no se pueden retirar envíos externos ya
iniciados. Las reglas de «taxi llegando», su deduplicación y su TTL se conservan;
si se generó mientras estaba silenciado, seguirá en la bandeja y no se reenvía
al habilitar esa categoría más tarde.

No cambió el contrato de la Edge Function ni se incorporaron módulos nativos.
Los cambios móviles se cargan desde Metro, sin recompilar Android/iOS. La
configuración del servidor continúa enviando únicamente a `development`.

### Validación realizada

El 7 de noviembre de 2026 se probó la migración con los scripts SQL de
dispositivos, procesador, taxi llegando, apertura y preferencias, dentro de una
transacción con `ROLLBACK`. Se verificó después que la tabla no había quedado
creada y que el invocador HTTP real se había restaurado. La migración se aplicó
al proyecto vinculado `ximbalgo` y se repitieron las pruebas sobre el esquema
aplicado, revirtiendo los datos temporales.

La comprobación final confirmó la base al día, el invocador HTTP real intacto
y ninguna preferencia de prueba persistida.

`supabase/tests/preferencias_notificaciones.sql` comprueba valores predeterminados,
aislamiento entre cuentas, permisos, validación de la RPC, conservación de otros
campos, categorías, cancelación en varios dispositivos/entornos, invalidación de
leases, continuidad de recibos, reintentos silenciados y ausencia de reenvío
histórico. Los dispositivos de prueba usan un proyecto aleatorio; no se conservan
sus avisos ni se contacta Expo desde las pruebas.

Pasaron TypeScript y las **140 pruebas automatizadas**, incluidas 22 nuevas de
preferencias, permiso explícito y bandeja: errores de red, cambios de cuenta,
respuestas tardías, reintentos, contador global, agrupación Realtime y limpieza
de listeners. La prueba en teléfonos queda pendiente. El propietario autorizó
crear los commits y subir esta parte a `feature/XG-0030-notificaciones-push`.

Con esa autorización también se desplegó `enviar-notificaciones`, que quedó
activa en su versión 6. Pasó `deno check` y la invocación real desde Vault y
`pg_net` respondió HTTP 200, sin errores ni timeout y sin trabajos pendientes
en ese momento. Una petición sin autorización respondió HTTP 401. El cron
continúa activo y la comprobación de migraciones confirmó la base al día.

```sh
npm run typecheck
npm test
npx supabase db query --remote --yes --file supabase/tests/preferencias_notificaciones.sql
npx supabase db push --remote --dry-run
```

### Prueba en teléfonos

1. Recargar ambas apps desde Metro. En el taxista, abrir «Notificaciones» desde
   Inicio o Perfil. Comprobar lista, contador, lectura individual, lectura de
   todos los avisos y apertura del detalle del viaje.
2. Abrir el engranaje de la bandeja del cliente. Desactivar «Reservas», dejarlo
   en segundo plano y aceptar una solicitud nueva desde el taxista. La aceptación
   debe quedar en la bandeja del cliente sin un push nuevo para ese evento.
3. Reactivar «Reservas» y repetir con otra reserva: debe recibir el push. La
   aceptación silenciada anteriormente no debe enviarse al reactivar.
4. En el taxista, silenciar todos los push y crear una nueva solicitud desde
   el cliente. La bandeja y el contador deben actualizarse sin un push nuevo.
   Reactivar y repetir con una solicitud nueva.
5. En el cliente, probar por separado «Taxi llegando» y «Avance del viaje» con
   aproximación real, abordaje y finalización. Confirmar el silencio únicamente
   de las categorías elegidas y restaurar los ajustes al terminar.
6. Revocar el permiso desde los ajustes del teléfono y regresar a la pantalla.
   Debe reflejar el bloqueo; habilitarlo y regresar debe permitir sincronizar
   el teléfono. Si se eligió «Ahora no» al inicio, usar «Activar notificaciones».
7. Sin conexión, intentar cambiar una preferencia o actualizar la bandeja.
   Debe informar el fallo y permitir reintentar al recuperar la conexión.
8. Si se dispone de dos teléfonos con la misma cuenta, comprobar que el silencio
   afecta a ambos y que las elecciones se reflejan al volver a Preferencias.

Las pruebas anteriores de navegación del punto 4 y de aproximación real de
«taxi llegando» también requieren confirmación en los teléfonos; los resultados
SQL y automatizados no acreditan su presentación nativa.
