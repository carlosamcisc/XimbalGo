# Pantalla de rutas del cliente

Este documento describe el trabajo de la rama `feature/XG-0009-Pantalla-rutas-cliente`: la pantalla **Rutas** del cliente, que muestra los trayectos disponibles y los taxistas que los cubren con datos de Supabase.

## Alcance implementado

- La pestaña **Rutas** de la barra inferior abre `ClienteRutasScreen` desde Inicio y desde Reservaciones.
- Cada tarjeta (`RutaCard`) muestra origen, destino, cuántos taxistas están en servicio, el precio más bajo («Desde $…»), el número de taxistas, los asientos libres y, si existen, la distancia y el tiempo estimado.
- Un buscador filtra por nombre, origen o destino, sin distinguir mayúsculas ni acentos.
- El filtro **Todas / En servicio** separa las rutas que tienen al menos un taxista activo.
- Al tocar una ruta se abre un panel con el detalle y la lista de taxistas: estado, horario, precio, teléfono y vehículos con asientos libres. El botón «Buscar taxis cercanos» lleva a Inicio, donde se reserva.
- Hay estados de carga, error (con «Reintentar») y vacío. Deslizar hacia abajo vuelve a cargar.

## De dónde salen las rutas

Las rutas son el catálogo `rutas` (`nombre`, `origen`, `destino`, `distancia_km`, `tiempo_estimado_min`, `precio_base`, `activa`). Cada taxista se relaciona con una ruta mediante `taxistas.ruta_id`, que agrega la migración `20261014120000_rutas_taxistas.sql`.

`construirRutas` (en `src/modules/cliente/rutas.ts`) arma la lista:

1. Cada ruta del catálogo recibe los taxistas con su `ruta_id`.
2. Los taxistas sin `ruta_id` (registrados antes de esta rama) o con una ruta desactivada se unen comparando `punto_partida`/`punto_destino` con `origen`/`destino`. Se ignoran mayúsculas, acentos y espacios repetidos. Si no coinciden con ninguna ruta, su trayecto se muestra como una ruta propia («Origen → Destino»).
3. El precio «Desde» es el menor entre `precio_base` y el `precio_ruta` de sus taxistas.
4. Los asientos libres solo cuentan vehículos de taxistas en servicio.

## `ruta_id` en taxistas

Antes la ruta del taxista era texto libre, así que «Oxkutzcab» y «Oxcutzcab» se trataban como lugares distintos. La migración:

- Agrega `taxistas.ruta_id` (llave foránea a `rutas`, `on delete set null`) con índice.
- Agrega `trigger_sincronizar_ruta_taxista`: al asignar o cambiar `ruta_id`, copia el `origen` y `destino` de la ruta en `punto_partida` y `punto_destino`, y rechaza rutas inactivas. Las columnas de texto se conservan para no romper lo que ya las usa.
- Agrega la política `rutas_ver_publico`, para que el usuario anónimo lea las rutas activas: el taxista elige su ruta en el registro, antes de tener sesión.
- Actualiza `handle_new_user` para guardar el `ruta_id` de la metadata del registro. Si la ruta no existe o está inactiva, la cuenta se crea sin ruta en vez de fallar.

### Corrección: teléfono vacío en el registro

`handle_new_user` leía el teléfono de `raw_user_meta_data ->> 'phone'`, pero la app lo envía como `telefono`. Por eso `usuarios.numero_telefono`, `clientes.telefono` y `taxistas.telefono` quedaban vacíos. Ahora la función lee `telefono` (y `phone` como respaldo), y la migración recupera el teléfono de las cuentas existentes desde `auth.users`.

### Registro del taxista

En `RegistroScreen`, los campos de texto «Punto de partida» y «Punto de destino» se reemplazaron por un selector de rutas del catálogo. Al elegir una ruta, si el precio está vacío se sugiere la tarifa base. `DatosRegistro` cambió `puntoPartida`/`puntoDestino` por `rutaId`, que se envía como `ruta_id` en la metadata.

## Tiempo real

La pantalla escucha cambios en `taxistas` y `asientos` (ambas ya están en la publicación `supabase_realtime`). Cuando un taxista entra o sale de servicio, o se reserva un asiento, la lista y el detalle se actualizan. Los eventos se agrupan durante 600 ms para hacer una sola recarga. `rutas` y `vehiculos` no están en la publicación; sus cambios se ven al deslizar para recargar.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/cliente/ClienteRutasScreen.tsx` | Presentación: buscador, filtros, lista, detalle y estados de carga/error/vacío. |
| `src/screens/cliente/useClienteRutas.ts` | Carga, refresco y suscripción en tiempo real. |
| `src/components/RutaCard.tsx` | Tarjeta de una ruta en la lista. |
| `src/modules/cliente/rutas.ts` | Tipos, unión del catálogo con los taxistas, búsqueda y formato de horario, duración y distancia. |
| `src/infrastructure/supabase/repositories/rutas.repository.ts` | Consultas a `rutas` y a `taxistas` (con vehículos y asientos) y canal de tiempo real. |
| `src/components/Icono.tsx` | Íconos `search`, `close`, `timer`, `straighten` y `groups`. |
| `src/navigation/types.ts`, `src/navigation/cliente/ClienteNavigator.tsx` | Ruta `ClienteRutas` con transición `fade`. |
| `ClienteInicioScreen.tsx`, `ClienteReservacionesScreen.tsx` | La pestaña Rutas ahora navega a la pantalla. |
| `src/screens/autenticacion/RegistroScreen.tsx`, `auth.service.ts`, `auth.types.ts` | Selector de ruta en el registro del taxista; envía `ruta_id`. |
| `src/infrastructure/supabase/database.types.ts` | Regenerado con `ruta_id`. |
| `src/infrastructure/supabase/database.functions.types.ts` | Los tipos manuales de las RPC reemplazan a los generados, que no admiten `null` en parámetros opcionales. |
| `supabase/migrations/20261014120000_rutas_taxistas.sql` | `ruta_id`, trigger de sincronización, política anónima de lectura de rutas y corrección de `handle_new_user`. |

## Datos de prueba

Se poblaron en la base remota para probar la pantalla:

- Rutas `Tekax - Oxkutzcab (ITTSY)`, `Akil - Oxkutzcab` y `Oxkutzcab - Ticul` (esta última sin taxistas), con ids `a0000000-0000-4000-8000-00000000000{1,2,3}`.
- Los dos taxistas existentes quedaron asignados a las dos primeras rutas.
- Vehículos `PRUEBA-001` (10 asientos) y `PRUEBA-002` (12 asientos), uno por taxista.
- Luis Alfredo quedó con `taxista_activo = true`, para que una ruta aparezca en servicio.

Para revertirlos:

```sql
begin;
delete from public.asientos where vehiculo_id in (select id from public.vehiculos where matricula like 'PRUEBA-%');
delete from public.vehiculos where matricula like 'PRUEBA-%';
update public.taxistas set taxista_activo = false where id = 'd792065b-e68d-4eb1-9e47-edec0fe3b553';
delete from public.rutas where id::text like 'a0000000-0000-4000-8000-00000000000%';
commit;
```

Al borrar las rutas, `ruta_id` de los taxistas vuelve a `null`; sus `punto_partida`/`punto_destino` conservan el texto de la ruta.

## Límites actuales y pendientes

- **Taxistas sin `ruta_id`.** Los registrados antes de esta rama siguen unidos por texto hasta que se les asigne una ruta. Falta una pantalla de perfil para que el taxista cambie su ruta (la política `taxistas_actualizar_propio` ya lo permite).
- **Una sola ruta por taxista.** Si un taxista cubre varias rutas, haría falta una tabla intermedia `taxistas_rutas`.
- **No se reserva desde Rutas.** Reservar necesita paraderos y un vehículo cercano; por eso el detalle lleva a Inicio.
- **El teléfono del taxista es visible** para cualquier cliente autenticado, porque la política `taxistas_ver_todos` permite leer todas las columnas. Conviene decidir si debe mostrarse antes de tener una reserva aceptada.

## Validación realizada

- `npm run typecheck` pasó.
- La migración se ejecutó contra la base remota dentro de una transacción revertida, simulando el registro de un taxista con ruta válida y otro con `ruta_id` inválido. Después se aplicó con `db push`.
- Se probó `construirRutas` uniendo por `ruta_id`, por texto (taxista sin `ruta_id`), con un taxista mal escrito y con una ruta desactivada.
- Con RLS simulado como cliente autenticado se ven las 3 rutas, los 2 taxistas con su `ruta_id` y sus asientos libres. Como anónimo, la API REST devuelve las rutas y ningún taxista.
- PostgREST acepta la consulta anidada `taxistas → vehiculos → asientos`.
- No se probó en un dispositivo.
