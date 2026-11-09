# Taxi llegando · XG-0030

El cliente recibe **«Tu taxi está llegando»** una sola vez por reserva cuando
el servidor detecta el taxi a **150 metros o menos** del punto de abordaje.
La distancia es en línea recta, igual que el umbral del mapa; no es una
estimación del trayecto por calles ni una garantía de tiempo de llegada.

## Cuándo se genera

- Reserva `aceptada`, con cliente aún sin abordar.
- Taxi en servicio, vehículo activo y asignado a ese taxista.
- Último GPS del taxi con menos de 90 segundos, sin fecha futura.
- Viaje inmediato, o programado para dentro de 15 minutos o menos.
- Punto de abordaje concreto y distancia de hasta 150 metros.
- Sin aviso previo de llegada para esa reserva.

El punto se elige en este orden:

1. Coordenadas de origen guardadas en la reserva.
2. Ubicación de su paradero de origen, si está activo.
3. Ubicación que el cliente comparte voluntariamente para esa reserva, con
   menos de 45 segundos, cuando no existen los dos puntos anteriores.

No se usa la última ubicación global del cliente ni se convierten nombres de
rutas en coordenadas. Una reserva creada solo con un origen textual requiere
un punto de abordaje concreto o ubicación compartida vigente para este aviso.
Compartir ubicación no cambia el punto elegido explícitamente al reservar.

## Detección y envío

La detección ocurre al actualizar GPS/servicio del taxista, al aceptar o cambiar
los datos de abordaje de una reserva y al actualizar la ubicación compartida
de esa reserva. Funciona con la app del cliente cerrada o bloqueada siempre
que el taxi continúe enviando ubicación y el cliente tenga push habilitado.

`reservas.llegada_notificada_en` se escribe con un UPDATE condicional. Esto
evita avisos duplicados por actualizaciones simultáneas, permanencia cerca,
oscilación del GPS o salir y volver al mismo punto. La marca es interna: las
cuentas de la app no pueden editarla ni invocar el detector directamente.

Se crea un registro `van_llegando` en `notificaciones`, que utiliza la cola
existente. Si el cron está activo y hay trabajos en cola, se solicita una
ejecución inmediata del procesador mediante `pg_net`, después del COMMIT.
La petición es asíncrona. Un fallo al solicitarla no impide guardar ubicación
o aceptar una reserva: el cron conserva su función de respaldo.

La pausa administrativa del cron también impide esta invocación inmediata.
Los filtros de proyecto y entorno del servicio push siguen vigentes; el
despliegue actual solo envía para `development`.

## Evitar avisos atrasados

Antes de cada intento de envío se vuelve a validar la reserva y la proximidad.
Si la reserva se canceló o terminó, el cliente ya abordó, el taxi se alejó,
salió de servicio o el GPS perdió vigencia, el trabajo se cancela con
`LlegadaNoVigente`. Se comprueba también la ubicación compartida cuando sea
la única fuente del punto de abordaje.

Los avisos de llegada tienen una vigencia máxima de cinco minutos y un TTL
limitado al tiempo restante. Un trabajo cancelado no vuelve a generar otro
aviso para la misma reserva; permanece el historial en la bandeja.

La validación ocurre al reclamar el trabajo. Un cambio después de enviarlo a
Expo no permite retirar un push que ya está en tránsito. Los recibos de un
envío aceptado se siguen consultando aunque después el cliente aborde.

## Archivos

- `supabase/migrations/20261107130000_taxi_llegando.sql`: detección, marca por
  reserva y validación de vigencia de los trabajos de llegada.
- `supabase/tests/taxi_llegando.sql`: pruebas en PostgreSQL y PostGIS reales.
- `src/infrastructure/supabase/database.types.ts`: nueva columna de reserva.

La función pública `reclamar_envios_push` conserva su contrato REST. Su
implementación anterior queda como `reclamar_envios_push_base`, accesible solo
internamente. No requiere cambiar ni redesplegar el worker existente.
La bandeja del cliente ya reconoce `van_llegando` y permite abrir la reserva.
La navegación al tocar el push del sistema se abordará en el punto 4.

## Validación automatizada

La migración y las pruebas se ejecutaron primero en una transacción revertida.
La prueba sustituye la invocación HTTP por un contador dentro de la transacción;
el ROLLBACK restaura la función real y el estado previo del cron, sin enviar
avisos reales ni conservar posiciones simuladas.

Se cubren los límites de 149/151 metros, pendientes y estados cerrados, aceptar
cuando ya está cerca, GPS antiguo/futuro, taxi fuera de servicio, abordaje,
viajes programados, prioridad GPS/paradero, ubicación voluntaria y su revocación,
deduplicación, despertar inmediato, pausa administrativa, TTL, permisos y
cancelación de trabajos que perdieron vigencia. Se comprueba también que los
recibos se pueden confirmar después del abordaje.

Se ejecutan además las pruebas de dispositivos, procesador y abordaje existentes,
`npm run typecheck` y las 97 pruebas de `npm test`.

El 7 de noviembre de 2026 se aplicó la migración al proyecto vinculado
`ximbalgo` (producción). La verificación final confirmó la base al día, el cron
activo y la función de invocación real restaurada después de las pruebas. Se
repitieron las pruebas de llegada y del procesador sobre el esquema aplicado,
con ROLLBACK de los datos temporales. El procesador desplegado respondió HTTP
200, sin errores ni timeout, con el mismo contrato REST.

Estos resultados validan el servidor; todavía no acreditan recepción del nuevo
aviso en un teléfono. El propietario pospuso esa prueba y autorizó versionar y
subir los cambios en la rama `feature/XG-0030-notificaciones-push`.

## Prueba en teléfonos

1. Mantener cliente y taxista registrados en la compilación de desarrollo,
   con permisos de push. El taxista debe estar en servicio y enviando GPS.
2. Crear una reserva con «Mi ubicación» o un paradero concreto como origen.
   Situar el taxi a más de 150 metros y aceptar la solicitud.
3. Bloquear el teléfono del cliente y acercar el taxi al punto de abordaje.
   Al entrar en el radio y recibirse el GPS nuevo debe generarse el aviso.
4. Permanecer cerca, salir y regresar: no debe repetirse en esa reserva.
5. Comprobar en la bandeja el aviso y, en `envios_push`, el ticket y el recibo.
   No hace falta recompilar por estos cambios de servidor.

También se puede probar aceptando una reserva inmediata cuando el taxi ya está
a 150 metros o menos del origen: debe generar el aviso en ese momento.

La prueba con movimiento real y recepción en un teléfono queda separada de
las pruebas SQL con coordenadas simuladas; no se acredita mediante ellas.
