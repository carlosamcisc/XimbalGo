# Pantalla de reservaciones del cliente

Este documento describe el trabajo de la rama `feature/XG-0008-Pantalla-reservaciones-cliente`: la pantalla de reservaciones del cliente, la creación de reservas desde la pantalla de inicio, la cancelación y la actualización en tiempo real con Supabase.

## Alcance implementado

### Pantalla de reservaciones

- La pestaña **Reservaciones** de la barra inferior abre `ClienteReservacionesScreen`. Desde ahí, la pestaña **Inicio** regresa a `ClienteInicioScreen`. La pestaña **Rutas** sigue siendo provisional.
- Las reservas del cliente autenticado se separan en dos vistas:
  - **En curso**: estados `pendiente` y `aceptada`.
  - **Historial**: `rechazada`, `cancelada_cliente`, `cancelada_taxista`, `completada` y `no_show`.
- Cada tarjeta (`ReservaCard`) muestra el estado, la fecha de solicitud, el origen, el destino, la matrícula y el taxista, además del precio si existe.
- Al tocar una reserva se abre un panel con el detalle: estado y su descripción, origen, destino, vehículo, taxista y teléfono, número de asiento, fecha, precio y notas.
- Si la reserva está en curso, el panel permite cancelarla con un paso de confirmación dentro del mismo panel.
- Hay estados de carga, error (con «Reintentar») y vacío. En **En curso** vacío se ofrece «Reservar un viaje», que lleva a Inicio.
- Deslizar hacia abajo vuelve a cargar la lista.

### Tiempo real

La pantalla se suscribe a los cambios de `reservas` filtrados por `cliente_id`. Cuando el taxista acepta, rechaza o completa una reserva desde su app, la lista y el detalle abierto se actualizan sin recargar. La tabla `reservas` ya estaba en la publicación `supabase_realtime`, y Realtime respeta las políticas RLS.

### Crear una reserva desde Inicio

- En la pantalla de inicio, tocar un taxi cercano con asientos abre un panel de confirmación con el origen, el destino y el taxi. Los taxis llenos no se pueden tocar.
- Para confirmar es necesario haber elegido origen y destino; si falta alguno, se muestra un aviso.
- Al confirmar se llama a `crear_reserva_cliente`. Si se crea, se muestra «Reservación enviada al taxista», se actualizan los taxis cercanos y se navega a Reservaciones.
- Si el origen es **Mi ubicación actual**, la reserva no tiene `paradero_origen_id`. La dirección y las coordenadas se guardan en `notas`, porque la tabla `reservas` solo almacena paraderos.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/cliente/ClienteReservacionesScreen.tsx` | Presentación: filtros, lista, detalle, confirmación de cancelación y estados de carga/error/vacío. |
| `src/screens/cliente/useClienteReservaciones.ts` | Carga de reservas, suscripción en tiempo real, refresco y cancelación. |
| `src/components/ReservaCard.tsx` | Tarjeta de una reserva en la lista. |
| `src/modules/cliente/reservas.ts` | Tipos `EstadoReserva`, `ReservaCliente` y `NuevaReserva`; etiquetas y colores por estado; formato de fecha y precio. |
| `src/infrastructure/supabase/repositories/reservas.repository.ts` | Consulta de reservas con sus relaciones, llamadas RPC para crear y cancelar, y suscripción en tiempo real. |
| `src/infrastructure/supabase/database.functions.types.ts` | Tipos TypeScript de las RPC `crear_reserva_cliente` y `cancelar_reserva_cliente`. |
| `src/screens/cliente/useClienteInicio.ts` | Nueva acción `reservar` y estado `reservando`; `mensajeError` se exporta para reutilizarlo. |
| `src/screens/cliente/ClienteInicioScreen.tsx` | Panel de confirmación de reserva y navegación a Reservaciones desde la barra inferior. |
| `src/components/TaxiCard.tsx` | Acepta `onPress` opcional; se deshabilita si el taxi está lleno. |
| `src/components/Icono.tsx` | Íconos `eventSeat`, `schedule`, `phone`, `payments` y `notes`. |
| `src/navigation/types.ts`, `src/navigation/cliente/ClienteNavigator.tsx` | Ruta `ClienteReservaciones` con transición `fade`. |
| `supabase/migrations/20261013120000_reservas_cliente.sql` | Funciones RPC para crear y cancelar reservas. |

La consulta de reservas indica explícitamente cada llave foránea (`paraderos!reservas_paradero_origen_id_fkey`, `vehiculos!reservas_vehiculo_id_fkey`, etc.), porque `reservas` tiene dos relaciones con `paraderos` y otra con la vista `vista_asientos_disponibles`.

## Funciones de Supabase y seguridad

### Por qué se usan funciones RPC

Las políticas RLS no permiten que un cliente actualice `asientos`; solo hay una política de lectura. Por eso, apartar el asiento y crear la reserva no se puede hacer con un `insert` directo desde la app. La migración crea dos funciones `SECURITY DEFINER` con `search_path` vacío, con `EXECUTE` concedido a `authenticated` y revocado de `public`.

### `crear_reserva_cliente(p_vehiculo_id, p_paradero_destino_id, p_paradero_origen_id, p_fecha_hora_viaje, p_notas)`

Valida, en este orden:

1. Que exista una sesión y que `auth.uid()` corresponda a un registro de `clientes`.
2. Que haya destino y que el origen, si se envía, sea distinto del destino.
3. Que la fecha del viaje, si se envía, no esté en el pasado.
4. Que los paraderos enviados estén activos.
5. Que el cliente no tenga otra reserva `pendiente` o `aceptada`.
6. Que el vehículo esté activo y su taxista también.
7. Que haya un asiento `disponible`. Lo bloquea con `FOR UPDATE SKIP LOCKED`, de modo que dos reservas simultáneas nunca toman el mismo asiento.

Después inserta la reserva en estado `pendiente` y marca el asiento como `reservado`. El `taxista_id` y el `precio` (`taxistas.precio_ruta`) los toma la base de datos; la app no los envía. Devuelve el `id` de la reserva.

### `cancelar_reserva_cliente(p_reserva_id)`

Cambia el estado a `cancelada_cliente` solo si la reserva pertenece al cliente autenticado y está `pendiente` o `aceptada`. En cualquier otro caso devuelve el error «La reservación ya no se puede cancelar.».

### Relación con el trigger existente

`trigger_notificar_reserva` (función `notificar_cambio_reserva`, ya existente) se encarga de:

- Notificar al taxista cuando se crea una reserva `pendiente` o el cliente la cancela.
- Notificar al cliente cuando la reserva se acepta, se rechaza, la cancela el taxista o se completa.
- Cambiar el asiento a `ocupado` al aceptar, y devolverlo a `disponible` al rechazar, cancelar o marcar `no_show`.

La migración se aplicó al proyecto Supabase enlazado durante esta rama. Antes se probó dentro de una transacción revertida, y después del `db push` se comprobó que ambas funciones existen como `SECURITY DEFINER`.

## Corrección: canal de tiempo real

Al volver a montar la pantalla de Reservaciones aparecía este error:

```
cannot add `postgres_changes` callbacks for realtime:reservas-cliente-<id> after `subscribe()`
```

`supabase.channel(nombre)` reutiliza un canal existente con el mismo nombre, y `removeChannel` es asíncrono. Al volver a montar la pantalla, el efecto pedía un canal con el mismo nombre, recibía el anterior ya suscrito y fallaba al agregar `.on(...)`. Ahora `escucharReservasCliente` agrega un contador al nombre, así que cada suscripción usa un canal nuevo.

## Configuración y ejecución

1. Instala las dependencias con `npm install`. Esta rama no agrega paquetes nuevos.
2. La migración ya está aplicada en el proyecto remoto. Para otro proyecto Supabase, revisa primero el proyecto enlazado y usa:

   ```powershell
   npx supabase db push --dry-run
   npx supabase db push
   ```

3. Para probar el flujo completo, la base necesita como mínimo:
   - Un taxista con `taxista_activo = true` y `ubicacion_actual` registrada.
   - Un vehículo activo de ese taxista; sus asientos los crea el trigger `trigger_generar_asientos`.
   - Dos paraderos activos con ubicación.
4. Inicia la aplicación con `npm run android`.

## Límites actuales y pendientes

> Desde XG-0013 la reserva se crea en `ClienteReservarScreen` con varios asientos, fecha y hora, y el detalle es una pantalla con seguimiento del taxi. Ver `cliente-reservar-asientos.md`.

- **Una reserva en curso por cliente.** Es una regla de negocio elegida para que nadie acapare asientos; si el negocio necesita reservar para varias personas, hay que cambiarla en `crear_reserva_cliente`.
- **El precio sale de `taxistas.precio_ruta`.** La tabla `rutas` tiene origen y destino como texto, sin relación con `paraderos`, así que `ruta_id` queda vacío.
- **El origen GPS se guarda en `notas`**, no en una columna estructurada.
- **Política de actualización demasiado amplia (seguridad).** La política `reservas_actualizar` permite al cliente modificar cualquier columna de sus reservas, incluido cambiar el estado a `aceptada`. La app solo cancela mediante la RPC, pero la política sigue abierta. No se cambió para no afectar el flujo del taxista; conviene restringirla.
- **El asiento no se libera al completar.** `notificar_cambio_reserva` no devuelve el asiento a `disponible` cuando la reserva pasa a `completada`; el asiento queda `ocupado`.
- **`vehiculos.realtime.ts` usa un nombre de canal fijo** (`vehiculos-realtime`). Tendría el mismo error que se corrigió en reservaciones si una pantalla lo usara y se volviera a montar. Hoy ninguna pantalla lo usa.
- **No se envían notificaciones push.** El trigger crea registros en `notificaciones`, pero la app todavía no los muestra.

## Validación realizada

- `npm run typecheck` pasó después de cada cambio.
- La migración se ejecutó contra la base remota dentro de una transacción revertida antes de aplicarla, y luego se aplicó con `db push`.
- Se verificó que `crear_reserva_cliente` y `cancelar_reserva_cliente` existen en la base remota.
- No hay pruebas automatizadas. El flujo de crear y cancelar no se ha probado de punta a punta porque la base remota no tenía vehículos, paraderos ni reservas.
