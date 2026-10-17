# Información de paradero

Este documento describe el trabajo de la rama `feature/XG-0012-Mostrar-informacion-de-paradero`: el cliente puede abrir cualquier paradero, cercano o de la lista completa, y ver su información.

## Alcance implementado

### Acceso

- En Inicio, tocar un paradero de **Paraderos cercanos a ti** abre su detalle. Antes lo seleccionaba como origen directamente; ahora eso se hace desde el detalle. Toda la fila es presionable, no solo la flecha.
- **Ver todo**, junto a ese título, abre `ClienteParaderosScreen` con todos los paraderos activos ordenados por nombre. Tiene un buscador por nombre o referencia que ignora mayúsculas, acentos y espacios repetidos. Tocar un paradero abre su detalle.

### Detalle (`ClienteParaderoScreen`)

- **Foto** del paradero (`paraderos.foto_url`). Si no hay foto, la URL no es `http(s)` o la imagen no carga, se muestra el ícono de ubicación.
- **Nombre**, también como título del encabezado.
- **Ubicación**: la dirección obtenida por geocodificación inversa de las coordenadas del paradero. Si no se obtiene, se muestran las coordenadas. Al llegar desde los cercanos se añade la distancia al cliente («A 350 m de ti»).
- **Referencia para llegar** (`paraderos.referencia`), o «Sin referencia registrada».
- **Ver en el mapa** abre el punto en la app de mapas del dispositivo (`geo:` en Android, Apple Maps en iOS) mediante `expo-linking`. Si no hay una app que lo acepte, abre Google Maps en el navegador. Se deshabilita si el paradero no tiene ubicación.
- **Seleccionar como origen** regresa a Inicio con `navigation.popTo("ClienteInicio", { paraderoOrigen })`. Inicio lo aplica con las mismas reglas que antes (si coincide con el destino, se pide otro destino), muestra el aviso y limpia el parámetro.
- Estados de carga y de error con «Reintentar», y deslizar hacia abajo para recargar. Si el paradero se desactivó, se informa que ya no está disponible.

## Supabase

Migración `20261019120000_detalle_paradero.sql` (aplicada al proyecto enlazado):

- `public.obtener_paradero(p_paradero_id uuid)` devuelve `id`, `nombre`, `referencia`, `foto_url`, `latitud` y `longitud`. `paraderos.ubicacion` es `geography` y PostgREST la entregaría como EWKB en hexadecimal, por eso la función la separa con `st_y`/`st_x`.
- Es `SECURITY INVOKER` con `search_path` vacío: la política RLS `paraderos_ver_todos` sigue limitando la lectura a paraderos activos. `EXECUTE` solo para `authenticated` (se revoca de `public` y `anon`).
- La lista completa se lee directamente de `paraderos` (`id, nombre, referencia, foto_url`) con el filtro `activo = true`.

No existen buckets de Storage: `foto_url` se trata como una URL pública completa.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/cliente/ClienteParaderoScreen.tsx` | Detalle del paradero y sus dos acciones. |
| `src/screens/cliente/ClienteParaderosScreen.tsx` | Lista completa con búsqueda. |
| `src/screens/cliente/useClienteParaderos.ts` | Carga de la lista y del detalle (con la dirección). |
| `src/components/FotoParadero.tsx` | Foto con respaldo cuando falta o falla. |
| `src/components/ParadaItem.tsx` | Fila presionable con foto opcional (`fotoUrl`). |
| `src/infrastructure/location/location.service.ts` | `abrirEnMapa`. |
| `src/infrastructure/supabase/repositories/cliente.repository.ts` | `obtenerParaderos` y `obtenerParadero`. |
| `src/screens/cliente/ClienteInicioScreen.tsx` | Navegación al detalle, «Ver todo» y recepción de `paraderoOrigen`. |
| `src/navigation/types.ts`, `src/navigation/cliente/ClienteNavigator.tsx` | Rutas `ClienteParaderos` y `ClienteParadero`. |

## Límites

- Los paraderos cercanos no traen la foto (la RPC de proximidad no la devuelve). Las fotos aparecen en la lista completa y en el detalle.
- La dirección depende de la geocodificación del sistema operativo. En Android puede requerir el permiso de ubicación; sin él se muestran las coordenadas.
- La lista completa no muestra distancias.

## Validación

- `npm run typecheck` pasa sin errores.
- `obtener_paradero` se probó en el proyecto remoto con el rol `authenticated` contra el paradero real («Paradero Kancab»), que devolvió sus coordenadas. Ese paradero no tiene foto, así que se ve el ícono de respaldo.
