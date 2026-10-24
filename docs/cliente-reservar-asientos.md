# Reservar asientos y seguimiento del taxi

Este documento describe el trabajo de la rama `feature/XG-0013-Reservar-numero-asientos`: el cliente elige cuántos asientos reserva y para cuándo, y después ve los detalles de su reservación y la ubicación del taxi en tiempo real.

## Alcance implementado

### Elegir el taxi

- En Inicio, tocar un taxi de **Taxis cerca de ti** abre `ClienteReservarScreen`. Antes abría un panel que reservaba un solo asiento.
- **Ver todo**, junto a ese título, abre `ClienteTaxisScreen` con todos los taxis en servicio con asientos libres, no solo los cinco más cercanos. Si hay GPS se ordenan por distancia; si no, por matrícula y sin distancia. Tiene buscador por matrícula, taxista o ruta, muestra la ruta y el precio por asiento, y se actualiza en tiempo real.
- `ClienteTaxisScreen` tiene arriba su propia sección **Tu viaje** con los mismos campos de origen y destino que Inicio: orígenes y destinos del catálogo de rutas, **Mi ubicación actual** y la regla de que sean distintos. Empieza con lo elegido en Inicio y se puede cambiar ahí mismo, sin volver. Elegir **Mi ubicación actual** recalcula las distancias de la lista desde ese punto.
- Para reservar hay que tener origen y destino; si falta alguno, se avisa al tocar el taxi.

### Reservar (`ClienteReservarScreen`)

- Resumen del viaje: origen, destino, taxi, vehículo y ruta.
- **¿Cuántos asientos?**: botones − y + entre 1 y los asientos libres (máximo 20). Los asientos libres se actualizan en tiempo real; si otro cliente toma asientos, la cantidad elegida baja sola.
- **¿Cuándo viajas?**: «Lo antes posible» o **Programar**: un día de los próximos 7 y un horario cada 15 minutos. Hoy solo se ofrecen horarios con al menos 15 minutos de anticipación.
- Notas opcionales para el taxista (hasta 200 caracteres).
- Resumen con la cantidad, la fecha y el **total** (precio por asiento × asientos).
- Al reservar se navega al detalle de la reservación nueva.

### Detalle y seguimiento (`ClienteReservaScreen`)

Se abre al reservar y al tocar cualquier reservación en **Mis reservaciones** (antes era un panel inferior).

- Estado de la reservación y su descripción.
- **Seguimiento en tiempo real** (solo con la reserva `pendiente` o `aceptada`):
  - **Hora estimada** en que el taxi pasará por el punto de abordaje, **minutos que faltan** y **distancia**. Los minutos bajan solos cada 15 segundos.
  - El **paradero cercano** al punto de abordaje, con su distancia y la hora a la que pasaría el taxi por ahí.
  - **Mapa** con el taxi, el punto de abordaje y el paradero; los marcadores se mueven sin recargar el mapa. Botón para volver a encuadrar.
  - Antigüedad de la última ubicación del taxi y una etiqueta **En vivo**.
  - Si el viaje está programado para más tarde que la llegada estimada, se aclara que el tiempo se calcula con la ubicación actual del taxi.
  - Si el taxista no está en servicio o su ubicación tiene más de 15 minutos, se explica que no está compartiendo su ubicación.
- **Detalles**: origen, destino, asientos con sus números, fecha y hora del viaje, taxi, taxista (toca para llamar mientras está en curso), precio total, fecha de solicitud y notas.
- **Cancelar reservación**, con confirmación; libera todos los asientos.
- Deslizar hacia abajo recarga, y al volver a la app desde segundo plano también.

### Taxista

- La tarjeta y el detalle de cada viaje muestran la cantidad de asientos, sus números y la fecha programada («En cuanto pases» si no la hay).
- La notificación de solicitud dice cuántos asientos se piden.

## Cálculo de la llegada

`estimarLlegada` (`src/modules/cliente/seguimiento.ts`):

1. Distancia en línea recta (haversine) entre la última ubicación del taxi y el punto de abordaje.
2. Se multiplica por 1.3 para aproximar la distancia por calles.
3. Se divide entre la velocidad promedio de la ruta: `rutas.distancia_km / rutas.tiempo_estimado_min`. Sin esos datos, 25 km/h.
4. La hora estimada cuenta desde que el taxi envió esa ubicación (`taxistas.ubicacion_actualizada_en`), así los minutos bajan aunque no llegue otra.
5. A 150 m o menos se muestra que el taxi está llegando.

El punto de abordaje sale de la reserva:

| Origen elegido | Punto de abordaje |
| --- | --- |
| Mi ubicación actual | `reservas.ubicacion_origen` |
| Un paradero | La ubicación del paradero |
| Un origen del catálogo de rutas (sin coordenadas) | La última ubicación del cliente (`clientes.ubicacion_actual`) |

## Supabase

Migración `20261020120000_reservar_varios_asientos.sql` (aplicada al proyecto enlazado):

- **`reservas.cantidad_asientos`** (`smallint`, 1 a 20, por defecto 1). Las reservas anteriores quedan con 1.
- **`crear_reserva_cliente`** recibe `p_cantidad_asientos` (por defecto 1, así las versiones anteriores de la app siguen funcionando) y ahora sí usa `p_fecha_hora_viaje` desde la app. Valida la cantidad y que la fecha no esté en el pasado ni a más de 7 días. Bloquea los asientos con `FOR UPDATE SKIP LOCKED`; si no alcanzan, responde «El taxi solo tiene N asiento(s) disponible(s).». El primer asiento queda en `reservas.asiento_id` y todos en `asientos.reserva_id`. `precio` = `taxistas.precio_ruta` × cantidad.
- **`notificar_cambio_reserva`** ocupa al aceptar, y libera al rechazar, cancelar, completar o marcar `no_show`, todos los asientos de la reserva (`id = asiento_id or reserva_id = id`).
- **`obtener_reservas_taxista`** devuelve además `cantidad_asientos` y `numeros_asientos`.
- **`obtener_taxis_disponibles(p_latitud, p_longitud)`**: como `obtener_taxis_cercanos`, hasta 100 filas, con la ruta y el precio. `SECURITY INVOKER`.
- **`obtener_seguimiento_reserva(p_reserva_id)`**: `SECURITY DEFINER`, solo para el cliente dueño de la reserva. Devuelve la ubicación del taxi (solo con la reserva en curso), si está en servicio con ubicación reciente, el punto de abordaje, el paradero activo más cercano a ese punto y la velocidad de la ruta. Las coordenadas se separan con `st_y`/`st_x` porque PostgREST entregaría `geography` como EWKB.
- `EXECUTE` solo para `authenticated`.

### Tiempo real

- `ClienteReservaScreen` escucha la fila de `reservas` (`id=eq.<reserva>`) y la de `taxistas` (`id=eq.<taxista>`). Cuando el taxista envía una ubicación (cada 50 m o, como mínimo, cada 5 minutos), se vuelve a pedir el seguimiento.
- `ClienteReservarScreen` escucha `asientos` del vehículo.
- `ClienteTaxisScreen` reutiliza `escucharDisponibilidadRutas` (`taxistas` y `asientos`).
- Las tres usan nombres de canal únicos, igual que `escucharReservasCliente`.

## Mapa

El mapa usa Leaflet y teselas de OpenStreetMap dentro de WebView para funcionar en Expo Go sin código nativo. Muestra taxi, abordaje y paradero; los marcadores se actualizan con los cambios recibidos y el botón vuelve a encuadrar. Requiere conexión a internet.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/cliente/ClienteReservarScreen.tsx`, `useClienteReservar.ts` | Elegir asientos, fecha, hora y notas; crear la reserva. |
| `src/screens/cliente/ClienteReservaScreen.tsx`, `useClienteReserva.ts` | Detalle, seguimiento, mapa, tiempo real y cancelación. |
| `src/screens/cliente/ClienteTaxisScreen.tsx`, `useClienteTaxis.ts` | Todos los taxis disponibles, con su propia selección de origen y destino. |
| `src/screens/cliente/useSeleccionViaje.ts` | Origen y destino del viaje: opciones del catálogo, GPS, paradero y validaciones. Lo usan Inicio y la lista de taxis. |
| `src/screens/cliente/SelectorViaje.tsx` | Campos de origen y destino con sus paneles de opciones. |
| `src/components/EstadoLista.tsx` | Carga, error o vacío de una lista (antes dentro de Inicio). |
| `src/screens/cliente/mensajeError.ts` | `mensajeError`; `useClienteInicio` lo reexporta para no cambiar las importaciones existentes. |
| `src/components/SelectorAsientos.tsx` | Botones − y + para la cantidad. |
| `src/components/SelectorFechaViaje.tsx` | «Lo antes posible» o día y hora. |
| `src/components/MapaSeguimiento.tsx` | Mapa Leaflet en WebView (`react-native-webview`). |
| `src/components/TaxiCard.tsx` | Línea opcional `detalle`. |
| `src/components/ReservaCard.tsx`, `ReservaTaxistaCard.tsx`, `src/screens/taxista/DetalleReservaTaxista.tsx` | Cantidad de asientos y fecha programada. |
| `src/modules/cliente/seguimiento.ts` | Tipos del seguimiento, distancia y estimación de llegada. |
| `src/modules/cliente/fechaViaje.ts` | Días y horarios que se ofrecen. |
| `src/modules/cliente/reservas.ts` | `cantidadAsientos`, `numerosAsientos`, `fechaViaje`; `etiquetaOrigen` y `origenDeReserva` (antes en `useClienteInicio`). |
| `src/infrastructure/supabase/repositories/reservas.repository.ts` | Una reserva, el seguimiento y `escucharReserva`. |
| `src/infrastructure/supabase/repositories/vehiculos.repository.ts` | Taxis disponibles, datos del taxi a reservar y `escucharAsientosVehiculo`. |
| `src/infrastructure/supabase/database.types.ts`, `database.functions.types.ts` | Tipos regenerados y RPC nuevas. |
| `src/screens/cliente/ClienteInicioScreen.tsx`, `useClienteInicio.ts` | Navegación a reservar y a todos los taxis; se quitó el panel de confirmación. |
| `src/screens/cliente/ClienteReservacionesScreen.tsx`, `useClienteReservaciones.ts` | La lista abre el detalle nuevo; la cancelación se movió al detalle. |
| `src/navigation/types.ts`, `src/navigation/cliente/ClienteNavigator.tsx` | Rutas `ClienteTaxis`, `ClienteReservar` y `ClienteReserva`. |

## Configuración y ejecución

1. `npm install` y la key de Google Maps en `.env` (ver [README.md](../README.md#google-maps)).
2. La migración ya está aplicada en el proyecto remoto. Para otro proyecto Supabase:

   ```powershell
   npx supabase db push --dry-run
   npx supabase db push
   ```

3. Compila de nuevo el cliente nativo: `npm run android`.
4. Para ver el seguimiento, el taxista debe tener el servicio iniciado con la app abierta (envía su ubicación).

## Límites

- **Estimación aproximada.** Es distancia en línea recta × 1.3 a la velocidad promedio de la ruta; no usa tráfico ni calles reales.
- **La ubicación del taxi solo se actualiza con su app abierta** (ver `taxista.md`).
- **Una reserva en curso por cliente** (regla existente); para varias personas se reservan varios asientos en una sola reserva.
- **Los números de asiento de las reservas cerradas** se pierden al liberarse los asientos; queda el primero (`reservas.asiento_id`) y la cantidad.
- **El mapa necesita internet** la primera vez que se ve una zona (Google Maps guarda en caché lo ya visto). Con una key inválida o sin restricción correcta, el mapa sale gris y el error aparece en `adb logcat` (`Google Android Maps SDK`).
- El origen del catálogo de rutas no tiene coordenadas: el seguimiento usa la última ubicación guardada del cliente; si nunca se guardó, no hay estimación.

## Validación realizada

- `npm run typecheck` pasa sin errores.
- `npx expo export --platform android` generó el bundle sin errores.
- La migración se ejecutó contra la base remota dentro de una transacción que siempre se revierte, con el taxista, el vehículo (10 asientos), la ruta «Kancab a Tekax» y el cliente reales, bajo el rol `authenticated`:
  - Reservar 3 asientos aparta 3 asientos y el precio es 3 × $30 = $90.
  - `obtener_seguimiento_reserva` devuelve la ubicación del taxi, el punto de abordaje (GPS) y el «Paradero Kancab» como paradero cercano; con origen del catálogo usa la última ubicación del cliente.
  - `obtener_taxis_disponibles` devuelve el taxi con 7 asientos libres, con y sin GPS.
  - Una segunda reserva en curso, 11 asientos, 0 asientos y una fecha a 8 días se rechazan con su mensaje.
  - Cancelar libera los 3 asientos; aceptar una reserva de 2 ocupa los 2 y completarla los libera.
  - `obtener_reservas_taxista` devuelve `cantidad_asientos = 2` y `numeros_asientos = {1,2}`.
  - Otro usuario no puede ver el seguimiento de la reserva.
- Después se aplicó con `db push` y se regeneraron los tipos.
- **No se probó en un dispositivo**: validar el mapa y el permiso de ubicación desde Expo Go.
