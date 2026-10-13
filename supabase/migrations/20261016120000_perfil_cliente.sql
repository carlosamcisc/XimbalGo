-- XG-0011: Perfil del cliente.
--
-- La pantalla de perfil actualiza `usuarios.numero_telefono`. La política
-- `usuarios_actualizar_propio` deja al usuario modificar su propia fila, y
-- `authenticated` tenía permiso de UPDATE sobre todas las columnas: cualquier
-- cliente o taxista podía cambiar su `rol_id` (y volverse administrador), su
-- `correo` o su estado `activo` con un `update` directo.
--
-- El rol, el correo y el estado solo los cambian funciones `security definer`
-- (registro) o el administrador desde el panel de Supabase.

revoke update on public.usuarios from anon, authenticated;
grant update (numero_telefono, foto_perfil_url) on public.usuarios to authenticated;
