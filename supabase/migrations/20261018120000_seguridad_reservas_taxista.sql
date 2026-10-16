-- Cierra escrituras directas que se saltaban las funciones con validación.
--
-- Las políticas `reservas_actualizar` y `reservas_cliente_crear`, con los
-- permisos por defecto de `authenticated`, dejaban a un cliente aceptar su
-- propia reserva, cambiarle el precio o crear reservas sin apartar asiento, y
-- a un taxista reasignar reservas a otro cliente. La app solo escribe reservas
-- con `crear_reserva_cliente`, `cancelar_reserva_cliente` y
-- `actualizar_reserva_taxista` (`security definer`), que no dependen de RLS.
--
-- Igual que con `usuarios` en `20261016120000_perfil_cliente.sql`, el resto de
-- tablas solo admite UPDATE en las columnas que la app edita directamente.
-- El servicio y la ubicación del taxista, la ubicación del cliente y los
-- asientos solo cambian mediante funciones.

drop policy if exists reservas_actualizar on public.reservas;
drop policy if exists reservas_cliente_crear on public.reservas;
revoke insert, update, delete, truncate on public.reservas from anon, authenticated;

revoke insert, update, delete, truncate on public.asientos from anon, authenticated;

revoke insert, update, delete, truncate on public.taxistas from anon, authenticated;
grant update (
  nombres, apellidos, telefono, direccion, horario_trabajo, precio_ruta, ruta_id
) on public.taxistas to authenticated;

revoke insert, update, delete, truncate on public.clientes from anon, authenticated;
grant update (nombres, apellidos, telefono, edad, direccion) on public.clientes to authenticated;

revoke insert, update, delete, truncate on public.notificaciones from anon, authenticated;
grant update (leida) on public.notificaciones to authenticated;
