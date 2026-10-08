# Pantalla de inicio del cliente

Este documento describe el trabajo de la rama `feature/XG-0007-Pantalla-inicio-cliente`: la interfaz inicial del cliente, sus componentes, la conexión con Supabase y la búsqueda de taxis y paraderos por proximidad.

## Alcance implementado

### Interfaz y navegación

- `ClienteNavigator` abre `ClienteInicioScreen` como pantalla inicial del rol cliente, sin mostrar el encabezado del navegador.
- La pantalla reúne el saludo y perfil del cliente, los selectores de origen y destino, una lista de taxis cercanos y otra de paraderos cercanos.
- La barra inferior presenta Inicio, Rutas y Reservaciones. En esta rama, Rutas y Reservaciones siguen siendo accesos provisionales; no implementan sus respectivos flujos.
- Se añadieron componentes reutilizables para tarjetas, insignias, encabezado del usuario, selectores, unidades y paraderos. `TaxiCard` omite la distancia si no se proporciona, y `ParadaItem` permite seleccionar el paradero como origen.
- Se migró la tipografía de la aplicación de Poppins a Inter.
- Se actualizó la paleta de Xímbal Go y se añadieron tokens de color que faltaban para componentes y pantallas. La declaración de colores y su tipo `ColorKey` viven en `src/theme/colors.ts`.
- También se corrigieron referencias de color de algunas pantallas de autenticación y se actualizaron los tipos generados de Supabase.

### Perfil y paraderos

Al abrir la pantalla, se consulta en paralelo:

1. El perfil de `clientes` asociado al ID del usuario autenticado (`nombres` y `apellidos`).
2. Los paraderos activos de `paraderos` (`id`, `nombre` y `referencia`).

El perfil alimenta el nombre y la inicial del encabezado. Los paraderos activos se usan en los selectores de origen y destino. Si falta el perfil, falla una consulta o no existe sesión, se muestra el error y una acción de reintento. El gesto de deslizar hacia abajo vuelve a cargar el perfil y la lista de paraderos.

### Origen GPS y resultados cercanos

- El selector de origen ofrece **Mi ubicación actual** además de los paraderos activos.
- Elegir esa opción solicita permiso de ubicación mientras se usa la aplicación, comprueba que los servicios de ubicación estén habilitados y obtiene una posición con precisión balanceada mediante `expo-location`.
- Después de obtener el GPS, se muestra un panel inferior con la dirección obtenida mediante geocodificación inversa y las coordenadas. Si no hay una dirección disponible o falla esa consulta, las coordenadas siguen disponibles y se informa el problema; el origen GPS no se descarta.
- Al seleccionar un origen y un destino, se consultan hasta cinco resultados de cada tipo: taxis disponibles y paraderos activos. Los resultados se ordenan por distancia en metros al GPS del cliente y se presentan como metros o kilómetros.
- Solo se listan taxis con taxista activo, vehículo activo y asientos disponibles mayores que cero.
- Las búsquedas se ejecutan en Supabase mediante PostGIS. La app envía latitud y longitud y recibe las filas cercanas ya ordenadas; no descarga la ubicación de todos los taxistas para calcular distancias en el dispositivo.
- Si el usuario escoge un paradero como origen en vez del GPS, el paradero se usa como selección del viaje, pero la búsqueda de proximidad sigue tomando el GPS actual del dispositivo.
- Si el origen y el destino elegidos son el mismo paradero, se informa que deben ser distintos.
- Si no hay datos cercanos, se presenta un estado vacío. Los errores de la búsqueda incluyen una acción de reintento.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/screens/cliente/ClienteInicioScreen.tsx` | Estado de pantalla, carga inicial, selectores, solicitud de GPS, resultados, estados de carga/error/vacío y refresco. |
| `src/components/BottomSheet.tsx` | Contenedor genérico de panel inferior modal con fondo, cierre al tocar afuera y contenido reutilizable. |
| `src/navigation/cliente/ClienteNavigator.tsx` | Entrada de navegación del cliente. |
| `src/infrastructure/location/location.service.ts` | Permiso de ubicación en primer plano y lectura de la posición actual con Expo Location. |
| `src/infrastructure/supabase/repositories/cliente.repository.ts` | Lectura del perfil, paraderos activos y resultados cercanos de paraderos. |
| `src/infrastructure/supabase/repositories/vehiculos.repository.ts` | Lectura de disponibilidad y resultados cercanos de taxis. |
| `src/infrastructure/supabase/database.functions.types.ts` | Tipos TypeScript para las funciones RPC de proximidad. |
| `src/infrastructure/supabase/client.ts` | Cliente Supabase tipado con las funciones RPC añadidas. |
| `src/modules/cliente/ubicacion.ts` | Tipos de coordenadas/resultados y formato de distancia para la interfaz. |
| `src/components/TaxiCard.tsx`, `src/components/ParadaItem.tsx` | Presentación de cada resultado. |
| `src/theme/colors.ts` | Paleta y tokens utilizados por la interfaz. |
| `app.json`, `package.json` | Configuración nativa de ubicación y dependencia `expo-location`. |
| `supabase/migrations/20261008210000_busqueda_cercana_cliente.sql` | Funciones RPC PostGIS para consultar los cinco resultados cercanos. |

Las consultas y los tipos de base se mantienen en la infraestructura de Supabase; la pantalla consume las funciones del repositorio en lugar de construir consultas SQL directamente.

## Funciones de Supabase y seguridad

La migración crea:

- `public.obtener_paraderos_cercanos(p_latitud, p_longitud, p_limite)`: selecciona paraderos activos con ubicación, calcula la distancia PostGIS y ordena los resultados.
- `public.obtener_taxis_cercanos(p_latitud, p_longitud, p_limite)`: combina taxistas y vehículos activos con `vista_asientos_disponibles`, calcula la distancia a la ubicación del taxista y ordena los resultados.

Ambas funciones limitan el parámetro a un máximo de cinco filas. Se declaran `SECURITY INVOKER`, usan un `search_path` vacío y conceden `EXECUTE` a `authenticated`, no a `public`. Las consultas siguen sujetas a las políticas RLS del proyecto. Por tanto, las políticas existentes deben permitir a los usuarios autenticados leer los perfiles/paraderos que les corresponden y consultar los datos necesarios para ambas funciones; de lo contrario, Supabase devolverá un error visible en la pantalla.

La migración `20261008210000_busqueda_cercana_cliente.sql` se aplicó al proyecto Supabase enlazado durante esta rama. El `db push` terminó correctamente y una comprobación posterior informó que la base remota estaba al día.

## Configuración y ejecución

1. Instala las dependencias del proyecto:

   ```powershell
   npm install
   ```

2. Configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en el entorno local, sin guardar secretos en el repositorio.
3. Para aplicar migraciones pendientes a un proyecto Supabase, revisa primero el proyecto enlazado y usa:

   ```powershell
   npx supabase migration list
   npx supabase db push
   ```

   La migración de esta rama ya se aplicó al proyecto usado durante la implementación.
4. Debido a que `expo-location` contiene código nativo, crea/actualiza el cliente nativo después de instalar o cambiar esta dependencia. Expo configura el permiso de iOS mediante el plugin y los permisos de primer plano de Android en la configuración de la aplicación.
5. Inicia la aplicación con `npm run android` o `npx expo run:android`.

## Límites actuales

- La cercanía se calcula contra la ubicación GPS del cliente; seleccionar un origen de paradero no cambia el punto usado para calcularla.
- La selección de destino no filtra taxistas o paraderos por compatibilidad con la ruta. El esquema disponible no proporciona una relación estable entre la ruta escogida y los taxistas/unidades que la cubren.
- La distancia es geográfica directa entre coordenadas; no es distancia de conducción ni tiempo estimado por carretera.
- Se muestran como máximo cinco resultados y no hay un radio máximo: si existen menos de cinco registros válidos, se muestran los encontrados, aunque estén lejos.
- Los resultados de taxis requieren que el taxista tenga `ubicacion_actual` registrada, además de estar activo y tener un vehículo activo con asientos disponibles.
- El permiso GPS se solicita al elegir «Mi ubicación actual» y, si todavía no se había obtenido, cuando se inicia una búsqueda con ambos selectores completos. Si se deniega o el GPS está desactivado, se informa el error y no se muestran resultados cercanos.
- La acción de perfil y las pestañas Rutas/Reservaciones no navegan todavía a flujos de perfil, reservas o rutas.

## Validación realizada

- `npm run typecheck` pasó tras integrar la pantalla, el GPS, las consultas y sus tipos.
- `npx expo config --type public` reconoció el plugin y generó los permisos de ubicación de Android en la configuración efectiva.
- Se comprobó que la migración fue aplicada al proyecto remoto y que no quedaban migraciones pendientes en ese momento.
