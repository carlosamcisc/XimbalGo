# Opciones del taxista sobre solicitudes y asientos

Este documento describe el trabajo de la rama `feature/XG-0013-Opciones-solicitudes-para-taxista`: el taxista marca los asientos que se ocuparon sin reserva, explica al cliente por qué rechaza su solicitud y, si no tiene todos los asientos que le piden, le ofrece los que le quedan.

## Alcance implementado

### Asientos ocupados sin reserva (Vehículo)

- La tarjeta **Asientos** ahora está arriba del formulario del vehículo y sus asientos se pueden tocar.
- Tocar asientos **Libres** los selecciona; **Marcar N asientos como ocupado** los guarda como ocupados. Sirve para pasajeros que subieron en el camino sin reservar.
- Tocar asientos **Ocupados** sin reserva los selecciona; **Liberar N asientos** los deja libres otra vez.
- Se pueden seleccionar libres y ocupados a la vez: aparece un botón para cada grupo. **Quitar selección** limpia todo.
- Los asientos de una reservación no se pueden marcar: los **Reservados** y los ocupados por un viaje aceptado (ahora dicen **En viaje**) se liberan solos al cerrar ese viaje. Al tocarlos se explica eso.
- Si un cliente reserva un asiento seleccionado antes de guardar, deja de estar seleccionado; si pasa justo al guardar, la base rechaza el cambio completo y la pantalla se recarga.
- En Inicio, debajo del resumen de asientos, el enlace **¿Subió alguien sin reservar? Marca sus asientos** lleva a Vehículo.
- Un asiento ocupado sin reserva no aparece como disponible para los clientes (los clientes ven `asientos_disponibles`).

### Motivo del rechazo

- **Rechazar** (en la tarjeta o en el detalle) ya no muestra la confirmación de antes: abre un panel con motivos frecuentes y **Otro motivo** para escribirlo (hasta 200 caracteres). El motivo es obligatorio.
- **Cancelar viaje** (en un viaje aceptado) usa el mismo panel; ahí el motivo es opcional.
- El cliente ve el motivo:
  - En la notificación: «El taxista rechazó tu solicitud. Motivo: …».
  - En el detalle de su reservación, debajo del estado.
  - En la tarjeta de **Mis reservaciones**.
- El taxista ve el motivo que dio en la tarjeta del historial y en el detalle.

### Ofrecer los asientos que quedan

- En una solicitud pendiente de 2 o más asientos, la tarjeta muestra **No tengo todos: ofrecer menos asientos** y el detalle **Ofrecer menos asientos**. El panel de rechazo también lo sugiere.
- El taxista elige cuántos tiene (de 1 a los pedidos menos uno) y ve el nuevo total para el cliente.
- Al enviar la oferta:
  - La reserva conserva sus primeros N asientos.
  - Los demás quedan **ocupados sin reserva**: el taxista dijo que no los tiene, así nadie más los reserva. Puede liberarlos en Vehículo.
  - Mientras el cliente no responde, el taxista solo puede **Rechazar**; la tarjeta dice «Ofreciste N de M. Esperando respuesta del cliente.».
- El cliente recibe la notificación «Pediste M asientos, pero el taxista solo tiene N disponibles…» y en el detalle de su reservación aparece la tarjeta **El taxista solo tiene N asientos**, con el nuevo total (el anterior tachado):
  - **Aceptar N asientos**: la reserva queda **aceptada** con N asientos y el precio por asiento original × N. El taxista recibe «El cliente aceptó N asientos».
  - **No acepto, cancelar solicitud** (con confirmación): la reserva queda cancelada por el cliente y se liberan sus asientos. El taxista recibe «El cliente no aceptó los N asientos que ofreciste».
- En **Mis reservaciones**, la tarjeta avisa «El taxista solo tiene N asientos. Toca para responder.».
- Todo llega en tiempo real a ambos lados (canales existentes de `reservas` y `asientos`).

## Supabase

Migración `20261021120000_opciones_solicitudes_taxista.sql` (aplicada al proyecto enlazado):

| Cambio | Detalle |
| --- | --- |
| `reservas.motivo_taxista` | `text`, 1 a 200 caracteres. Solo se guarda al rechazar o cancelar por el taxista. |
| `reservas.asientos_ofrecidos` | `smallint`, 1 a 20. Se queda después de responder, como historial. |
| `notificaciones_tipo_check` | Nuevo tipo `asientos_ofrecidos`. |
| `marcar_asientos_taxista(p_asiento_ids, p_ocupado)` | Solo asientos del vehículo del taxista y sin reserva. Ocupar exige que estén `disponible`; liberar, que estén `ocupado`. Todo o nada, con `FOR UPDATE`, así `crear_reserva_cliente` (`SKIP LOCKED`) no los toma a la vez. |
| `actualizar_reserva_taxista(p_reserva_id, p_estado, p_motivo)` | Nuevo `p_motivo` (por defecto null, así la app anterior sigue funcionando para aceptar y cerrar viajes). Exige motivo para `rechazada`. No deja aceptar con una oferta sin responder. |
| `ofrecer_asientos_taxista(p_reserva_id, p_cantidad)` | Solo en `pendiente`, una vez por reserva, de 1 a `cantidad_asientos - 1`. Pasa los asientos sobrantes (los de número más alto) a `ocupado` sin reserva. |
| `responder_oferta_asientos_cliente(p_reserva_id, p_acepta)` | Solo el cliente dueño y con oferta pendiente. Acepta: `estado = aceptada`, `cantidad_asientos = asientos_ofrecidos`, `precio = precio / cantidad × ofrecidos`. No acepta: `cancelada_cliente`. |
| `notificar_cambio_reserva` | Motivo en los avisos de rechazo y cancelación; aviso al cliente cuando recibe una oferta; aviso al taxista cuando el cliente la acepta o no. |
| `trigger_notificar_reserva` | Ahora escucha `estado` y `asientos_ofrecidos` (antes solo `estado`). |
| `obtener_reservas_taxista` | Devuelve además `motivo_taxista` y `asientos_ofrecidos`. |

Todas son `SECURITY DEFINER`, validan con `auth.uid()` y solo `authenticated` puede ejecutarlas.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/taxista/useAccionReserva.ts` | Ahora devuelve `ejecutar`, `ofrecer` y el estado de los paneles. Las acciones con motivo abren el panel en lugar de un `Alert`. Espera a que se cierre el detalle antes de abrir otro panel (en iOS un `Modal` no se presenta mientras otro se cierra). |
| `src/screens/taxista/PanelesReservaTaxista.tsx` | Paneles de motivo y de oferta. Se cierran solos si la reserva cambia en tiempo real y el panel ya no aplica. |
| `src/screens/taxista/DetalleReservaTaxista.tsx` | Recibe `acciones`; muestra el motivo, el aviso de la oferta y **Ofrecer menos asientos**. |
| `src/screens/taxista/TaxistaContext.tsx` | `operarReserva` (una operación a la vez con cambio inmediato), `responderReserva` con motivo, `ofrecerAsientos` y `marcarAsientos`. |
| `src/screens/taxista/TaxistaVehiculoScreen.tsx` | Selección y marcado de asientos. |
| `src/screens/taxista/TaxistaInicioScreen.tsx`, `TaxistaViajesScreen.tsx` | Paneles y oferta desde la tarjeta; enlace a marcar asientos. |
| `src/components/ReservaTaxistaCard.tsx` | Botón de oferta, aviso de oferta pendiente y motivo. |
| `src/modules/taxista/types.ts` | `conReserva` y `asientoEditable`; motivo y oferta en `ReservaTaxista`; `accionesDisponibles(reserva)`; motivos frecuentes. |
| `src/infrastructure/supabase/repositories/taxista.repository.ts` | `actualizarReserva` con motivo, `ofrecerAsientos`, `marcarAsientos` y `reserva_id` de los asientos. |
| `src/screens/cliente/ClienteReservaScreen.tsx`, `useClienteReserva.ts` | Tarjeta de oferta, respuesta y motivo. |
| `src/components/ReservaCard.tsx` | Avisos de oferta y motivo en la lista. |
| `src/modules/cliente/reservas.ts` | `motivoTaxista`, `asientosOfrecidos`, `tieneOfertaAsientos`, `precioOferta`. |
| `src/infrastructure/supabase/repositories/reservas.repository.ts` | Columnas nuevas y `responderOfertaAsientos`. |
| `src/modules/cliente/types.ts`, `src/screens/cliente/ClienteNotificacionesScreen.tsx` | Tipo de notificación `asientos_ofrecidos`. |
| `src/infrastructure/supabase/database.types.ts`, `database.functions.types.ts` | Tipos regenerados y RPC con parámetros que admiten null. |

## Configuración

La migración ya está aplicada en el proyecto remoto. Para otro proyecto:

```powershell
npx supabase db push --dry-run
npx supabase db push
```

No hay dependencias nuevas ni código nativo nuevo.

## Límites

- **Los asientos sobrantes de una oferta quedan ocupados** aunque el cliente no la acepte o el taxista rechace después; el taxista los libera en Vehículo cuando de verdad estén libres.
- **Una sola oferta por solicitud.** Para cambiarla, el taxista rechaza la solicitud con su motivo.
- **Sin notificaciones push** (ver `taxista.md`): las notificaciones se ven en la app.
- Los asientos ocupados sin reserva **no se liberan solos** al terminar el servicio.
- El taxista elige cuántos asientos ofrece, no cuáles: la reserva conserva los de número más bajo.

## Validación realizada

- `npm run typecheck` pasa sin errores.
- `npx expo export --platform android` generó el bundle sin errores.
- La migración se ejecutó contra la base remota dentro de una transacción que siempre se revierte, con el taxista real (vehículo `YUC-67FL`, 10 asientos, ruta Kancab a Tekax, $30) y el cliente real, bajo el rol `authenticated`:
  - Marcar los asientos 9 y 10 como ocupados funciona; repetirlo se rechaza («El asiento 9 ya está ocupado.»).
  - Una reserva de 5 aparta los asientos 1 a 5; marcar o liberar el asiento 1 se rechaza porque pertenece a la reservación.
  - Rechazar sin motivo (o con espacios) se rechaza.
  - Ofrecer 5 de 5 se rechaza; ofrecer 3 deja 1-3 en la reserva y 4-5 ocupados sin reserva; una segunda oferta y aceptar con la oferta pendiente se rechazan; el taxista no puede responder la oferta por el cliente.
  - El cliente recibe la notificación de la oferta; al aceptarla la reserva queda aceptada con 3 asientos y $90 (antes $150), y el taxista recibe «El cliente aceptó 3 asientos».
  - Cancelar el viaje con motivo libera los asientos 1-3 y el cliente recibe «El taxista canceló tu reserva. Motivo: Se descompuso la unidad».
  - Liberar 4, 5, 9 y 10 funciona.
  - Rechazar con motivo guarda el motivo y lo incluye en la notificación.
  - Una oferta no aceptada cancela la solicitud, avisa al taxista y no se puede responder dos veces.
  - Un usuario que no es taxista no puede marcar asientos y `anon` no puede ejecutar las funciones.
- Después se aplicó con `db push`, se repitieron las mismas pruebas sobre la base ya desplegada (también revertidas) y se regeneraron los tipos. PostgREST encuentra las cuatro funciones, incluida la llamada anterior de `actualizar_reserva_taxista` sin motivo, y se las niega a `anon`.
- **No se probó en un dispositivo.**
