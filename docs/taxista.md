# Pantallas del taxista

Este documento describe el trabajo de la rama `feature/XG-0010-Pantallas-taxista`: las pantallas con las que el taxista opera su servicio con datos de Supabase.

## Alcance implementado

La barra inferior del taxista tiene cuatro pestañas.

### Inicio (`TaxistaInicioScreen`)

- Saludo y estado de servicio: **En servicio** o **Fuera de servicio**.
- Para iniciar el servicio se requiere una ruta y un vehículo activo. Si falta alguno, la pantalla muestra qué falta y un enlace a Perfil o Vehículo.
- Al iniciar, la app pide permiso de ubicación y envía la posición. Mientras está en servicio:
  - Envía la ubicación cada vez que el taxista se mueve 50 m (como máximo cada 30 s).
  - Reenvía la última ubicación cada 5 minutos, para que no se venza mientras espera en un paradero.
  - Al volver a la app, recarga los datos y envía la ubicación de inmediato.
- Resumen de la ruta, el precio y los asientos libres, reservados y ocupados.
- Solicitudes pendientes con botones **Aceptar** y **Rechazar**, que llegan en tiempo real.
- Al terminar el servicio con viajes en curso, se pide confirmación; los viajes siguen abiertos.

### Viajes (`TaxistaViajesScreen`)

- **En curso** (`pendiente`, `aceptada`) e **Historial**.
- El detalle muestra cliente, teléfono (toca para llamar), origen, destino, asiento, fecha, precio y notas, con las acciones que permite el estado:
  - `pendiente` → Aceptar, Rechazar.
  - `aceptada` → Viaje completado, No se presentó, Cancelar viaje.
- Las acciones que liberan el asiento piden confirmación.

### Vehículo (`TaxistaVehiculoScreen`)

- Registro y edición: matrícula, marca, modelo, año, capacidad (1 a 20) y activo.
- Desactivar el vehículo termina el servicio.
- Mapa de asientos con su estado, actualizado en tiempo real.
- No se puede borrar el vehículo (ver «Seguridad»).

### Perfil (`TaxistaPerfilScreen`)

- Nombre, apellidos, teléfono y dirección.
- Ruta (selector del catálogo), horario y precio por pasajero. Al elegir ruta con el precio vacío se sugiere la tarifa base.
- El teléfono se guarda también en `usuarios.numero_telefono`.
- **Cerrar sesión**: si está en servicio, primero lo termina.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/taxista/TaxistaContext.tsx` | Estado compartido de las cuatro pantallas: perfil, vehículo, reservas, servicio, envío de ubicación y una sola suscripción en tiempo real. |
| `src/screens/taxista/Taxista{Inicio,Viajes,Vehiculo,Perfil}Screen.tsx` | Presentación de cada pestaña. |
| `src/screens/taxista/DetalleReservaTaxista.tsx` | Panel de detalle y acciones de una reserva. |
| `src/screens/taxista/useAccionReserva.ts` | Confirmación, ejecución y aviso de una acción sobre una reserva. |
| `src/screens/taxista/navegacion.ts` | Pantalla de cada pestaña. |
| `src/components/ReservaTaxistaCard.tsx` | Tarjeta de reserva con acciones rápidas para solicitudes pendientes. |
| `src/components/BottomTabBar.tsx` | Ahora recibe sus pestañas (`TABS_CLIENTE`, `TABS_TAXISTA`). |
| `src/modules/taxista/types.ts` | Tipos, acciones permitidas por estado, textos y vigencia de la ubicación. |
| `src/infrastructure/supabase/repositories/taxista.repository.ts` | Consultas, RPC y canal de tiempo real del taxista. |
| `src/infrastructure/location/location.service.ts` | `observarUbicacion` (`watchPositionAsync`) y mensaje de permiso configurable. |
| `src/navigation/taxista/TaxistaNavigator.tsx` | Cuatro pantallas dentro de `TaxistaProvider`. |
| `supabase/migrations/20261015120000_operacion_taxista.sql` | Funciones, triggers, políticas y correcciones descritas abajo. |

El proveedor envuelve el navegador, así que el envío de ubicación sigue activo al cambiar de pestaña y no se duplican suscripciones.

## Base de datos

### Funciones RPC (`security definer`, validan con `auth.uid()`)

| Función | Qué hace |
| --- | --- |
| `cambiar_servicio_taxista(p_en_servicio, p_latitud, p_longitud)` | Para iniciar, exige ruta activa, vehículo activo y ubicación. Al terminar, borra la ubicación. |
| `actualizar_ubicacion_taxista(p_latitud, p_longitud)` | Guarda la ubicación solo si está en servicio. |
| `obtener_reservas_taxista()` | Reservas del taxista con el nombre del cliente (RLS no le deja leer `clientes`). El teléfono solo llega mientras la reserva está `pendiente` o `aceptada`. |
| `actualizar_reserva_taxista(p_reserva_id, p_estado)` | Solo permite `pendiente → aceptada/rechazada` y `aceptada → completada/no_show/cancelada_taxista`. |

Se quitó el permiso de ejecución a `anon` y `public`.

### Ubicación vigente

Nueva columna `taxistas.ubicacion_actualizada_en`. Como la app solo envía la ubicación abierta, un taxista que la cierra sin terminar el servicio quedaría «en servicio» para siempre. Por eso:

- `obtener_taxis_cercanos` ignora ubicaciones de hace más de 15 minutos.
- La pantalla Rutas del cliente solo cuenta como «en servicio» a quien tenga ubicación reciente.

### Asientos

- **Corrección:** `notificar_cambio_reserva` no liberaba el asiento en `no_show` (salía antes por no tener notificación) ni en `completada`. Ahora lo libera en ambos, sin cambiar las notificaciones. La migración también libera los asientos que ya estaban atorados.
- `trigger_ajustar_asientos`: al cambiar la capacidad del vehículo agrega asientos, o quita los últimos solo si están libres.

### Seguridad

- `reservas.vehiculo_id` es `on delete cascade`: borrar un vehículo borraría el historial de reservas de los clientes. La política `vehiculos_gestionar_propio` (que incluía `DELETE`) se reemplazó por `vehiculos_insertar_propio` y `vehiculos_actualizar_propio`. El taxista solo puede desactivar su vehículo.

## Límites actuales y pendientes

- **Ubicación solo con la app abierta.** `watchPositionAsync` no funciona en segundo plano. Para eso se necesita `startLocationUpdatesAsync`, permisos `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` y revisión de Google Play. Si el taxista cierra la app, deja de aparecer a los 15 minutos.
- **Un vehículo por taxista** en la app, aunque la base admite varios.
- **Sin notificaciones push.** Las solicitudes llegan en tiempo real solo con la app abierta.
- **Sin paraderos en la base.** Los clientes no pueden reservar hasta que existan paraderos activos con ubicación, y no hay pantalla de administrador para crearlos.
- **`reservas_actualizar` sigue siendo amplia** (pendiente desde XG-0008): permite al cliente o taxista cambiar cualquier columna de sus reservas con un `update` directo. La app solo usa las RPC.
- **Datos de prueba de XG-0009** (vans `PRUEBA-*`, rutas de ejemplo) siguen en la base.

## Validación realizada

- `npm run typecheck` pasó.
- `npx expo export --platform android` generó el bundle sin errores.
- La migración se ejecutó contra la base remota en una transacción revertida, con un taxista y un cliente simulados bajo RLS:
  - Iniciar servicio sin vehículo y sin ubicación se rechaza; con ambos funciona y el cliente lo ve en `obtener_taxis_cercanos`.
  - Borrar el vehículo afecta 0 filas.
  - El cliente no puede aceptar su propia reserva; `pendiente → completada` se rechaza.
  - Aceptar ocupa el asiento; completar y `no_show` lo liberan.
  - Reducir la capacidad quitando un asiento ocupado se rechaza; aumentar y reducir con asientos libres funciona.
  - El teléfono del cliente se oculta al cerrar la reserva. Las notificaciones siguen generándose.
- PostgREST acepta las relaciones de las consultas nuevas y niega `obtener_reservas_taxista` a `anon`.
- **No se probó en un dispositivo.**
