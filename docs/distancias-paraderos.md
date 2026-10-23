# Distancias a paraderos con GraphHopper

Este documento describe el trabajo de la rama `feature/XG-0017-Calculo-ETA-Maps`: los paraderos cercanos muestran la distancia por calle y el tiempo caminando y en moto, y se cierra el acceso a la ubicación de los taxistas.

## Alcance implementado

- En Inicio, cada paradero de **Paraderos cercanos a ti** muestra «850 m · 11 min caminando · 3 min en moto». La distancia es por calle caminando, y la lista se ordena por ella.
- Si el paradero está a más de 2 km caminando, ya no se muestra el tiempo caminando: se muestra la distancia y el tiempo en moto («17.9 km · 22 min en moto»).
- El detalle del paradero repite esos datos («A 850 m · 11 min caminando · 3 min en moto de ti») cuando se abre desde Inicio.
- Las distancias no coinciden exactamente con Google Maps: GraphHopper usa el mapa de OpenStreetMap, y a pie puede tomar atajos que un auto no puede. Google Maps abre en modo auto.
- Si GraphHopper no responde, falla una ruta o la Edge Function no está disponible, se muestra la distancia en línea recta sin tiempos, como antes.
- La distancia se mide desde el GPS del cliente, igual que antes.

## Arquitectura

```
App → Edge Function `distancias-paraderos` → RPC `obtener_paraderos_cercanos` (PostGIS, 5 más cercanos en línea recta)
                                          → GraphHopper `/route` (perfil a pie y perfil moto, por paradero)
```

- La clave de GraphHopper solo existe como secreto de Supabase; no está en la app.
- La función llama a la RPC con el token del cliente: sin sesión válida la RPC falla y no se consume ningún crédito de GraphHopper.
- Guarda en memoria las rutas por 10 minutos (origen redondeado a unos 11 m) para no repetir llamadas al refrescar.

## Supabase

Migración `20261023120000_distancias_paraderos.sql`:

- **Privacidad del GPS del taxista.** La política `taxistas_ver_todos` (`using (true)`) dejaba a cualquier usuario autenticado leer `taxistas.ubicacion_actual` de todos los taxistas, también por Realtime. Se quita el permiso `SELECT` sobre esa columna; Realtime omite las columnas sin permiso. La ubicación del taxi solo se entrega con `obtener_seguimiento_reserva` mientras la reserva está en curso.
- `obtener_taxis_cercanos` y `obtener_taxis_disponibles` pasan a `security definer`, porque leían la columna con los permisos del cliente. Solo devuelven la distancia.
- `obtener_paraderos_cercanos` devuelve además `latitud` y `longitud` del paradero.

### Secretos de la Edge Function

| Secreto | Desarrollo (GraphHopper Cloud) | Producción (servidor propio) |
| --- | --- | --- |
| `GRAPHHOPPER_URL` | sin definir (`https://graphhopper.com/api/1`) | `https://rutas.<dominio>` |
| `GRAPHHOPPER_API_KEY` | key de graphhopper.com | clave que valida el proxy |
| `GRAPHHOPPER_PERFIL_PIE` | sin definir (`foot`) | `foot` |
| `GRAPHHOPPER_PERFIL_MOTO` | sin definir (`car`) | `moto` |

```
npx supabase secrets set GRAPHHOPPER_API_KEY=<key>
npx supabase functions deploy distancias-paraderos
```

## Límites

- **El plan gratis de GraphHopper Cloud es solo para uso no comercial** y solo incluye `car`, `bike` y `foot`: la moto se aproxima con `car`. Sirve para desarrollo; en producción se usa el servidor propio.
- Cada consulta usa 10 rutas (5 paraderos × 2 perfiles). Si cada ruta cuesta 1 crédito, los 500 créditos diarios alcanzan para unas 50 consultas sin caché. Si se acaban, la app muestra la línea recta.
- La lista completa de paraderos sigue sin distancias.

## Validación

- `npm run typecheck` pasa sin errores.
