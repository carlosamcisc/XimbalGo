# US-0028: ruta al paradero seleccionado

## Acciones y jerarquía visual

Inmediatamente debajo del mapa aparece una fila con **Mapa externo** a la izquierda y **Maximizar mapa** a la derecha. Este último conserva el fondo azul claro e icono de la pantalla Yo. Ambos tienen la misma altura y permiten ajustar el texto en varias líneas. **Cómo llegar a pie** y **Cómo llegar en moto** aparecen más abajo con el componente reutilizable `src/components/Chip.tsx`, que también se utiliza para el mapa externo. Los chips llevan iconos, estados de selección/pulsación/carga/deshabilitado, etiquetas de accesibilidad y un área táctil mínima de 44 puntos. **Seleccionar como origen** se mantiene como el único botón principal de ancho completo.

`Chip` recibe `titulo`, `onPress`, `icono` opcional, `variante` (`suave` o `contorno`), `seleccionado`, `cargando`, `disabled`, `accessibilityLabel`, `accessibilityHint` y `style`. El modo seleccionado tiene fondo suave, borde resaltado y estado accesible. En el mapa ampliado se reutiliza para cerrar, cambiar de modo, reintentar y abrir el mapa externo.

En el detalle de cualquier paradero con coordenadas reales, ambos modos solicitan permiso de ubicación en primer plano, obtienen el GPS actual y consultan una ruta por calles. Los chips permanecen visibles para alternar entre caminar y moto; al cambiar se descarta la geometría anterior y se calcula la del modo elegido. El resumen muestra la distancia y los minutos correspondientes. A partir de entonces el marcador sigue la ubicación y la ruta del modo elegido se actualiza automáticamente al desplazarse aproximadamente 50 metros desde el último origen consultado, con un máximo de una consulta automática cada 30 segundos. Un movimiento recibido durante ese intervalo se procesa al finalizar el límite, aunque el cliente se detenga. Se conserva el mapa durante el recálculo del mismo modo. Los errores de permisos, GPS y servicio permiten reintentar; si hay una ruta anterior, se identifica como la última calculada.

La observación del GPS se detiene al perder el foco de navegación, pasar a segundo plano o desmontar el componente. Al volver a la pantalla con la app activa se obtiene una ubicación nueva y se reanuda el seguimiento. No requiere ubicación en segundo plano ni cambios en Supabase. El botón **Actualizar ruta** se sustituye por el aviso de actualización automática; **Reintentar ruta** aparece si ocurre un error.

La pantalla distingue **Obteniendo tu ubicación…** de **Calculando la ruta caminando…**. La lectura de posición tiene un límite de 15 segundos (después de verificar permisos y servicios) y la consulta de rutas otros 15 segundos. Si una etapa excede su límite, deja de cargar, indica el problema y permite reintentar. La consulta de red se aborta al agotar el tiempo o abandonar la pantalla; las respuestas tardías se descartan.

El límite del GPS se solicita explícitamente desde `RutaParadero` mediante `tiempoEsperaMs`. El servicio compartido no impone ese límite por defecto: Inicio, taxis cercanos, reservas y compartir ubicación conservan su espera original de GPS.

Cuando ya existe una ruta, la distancia y el tiempo permanecen visibles durante nuevas consultas de GPS o recálculo; se muestra **Actualizando ruta…** como aviso secundario. Al pausar el seguimiento se limpia el estado de carga. Antes de solicitar permiso se comprueba si ya está concedido, tanto para obtener la posición como para iniciar la observación.

El resumen se presenta en una tarjeta de fondo suave: distancia y tiempo estimado destacados en dos columnas con iconos de ruta y modo de viaje. Debajo, un separador agrupa avisos compactos de actualización y estimación. La carga, la pausa y los errores tienen estados diferenciados; los errores conservan su mensaje completo y la indicación de la última ruta calculada. Antes de elegir un modo se muestra «Elige cómo llegar» con un icono. Las métricas se adaptan a varias filas cuando falta espacio.

El mapa conserva MapLibre y OpenFreeMap. Dibuja el trayecto de GraphHopper con marcadores y leyenda para el cliente y el paradero. El encuadre incluye toda la geometría; el botón de centrar recupera ese encuadre después de explorar. **Maximizar mapa** abre una vista de pantalla completa que se cierra con su botón o con Atrás de Android.

## Datos y servidor

La Edge Function existente `distancias-paraderos` acepta opcionalmente `paraderoId` junto con `latitud` y `longitud`. Si está presente, consulta `obtener_paradero` usando el token del cliente y las políticas RLS existentes. El parámetro `modo` admite `caminando` (predeterminado para clientes anteriores) o `moto`; cualquier otro valor devuelve 400 antes de consultar rutas. Obtiene el destino desde Supabase y solicita a GraphHopper la geometría con `calc_points=true` y `points_encoded=false`, utilizando `GRAPHHOPPER_PERFIL_PIE` o `GRAPHHOPPER_PERFIL_MOTO`. Devuelve `{ metros, segundos, geometria, modo, aproximada }`, con geometría GeoJSON `LineString` en orden longitud/latitud. La app verifica que el modo recibido coincida con el solicitado. Conserva los secretos y perfiles ya configurados; no requiere migraciones ni claves en la app.

El perfil predeterminado de moto es `car`, igual que en las distancias de paraderos cercanos. En ese caso `aproximada` es `true` y la app muestra «Estimación basada en un trayecto en auto». Si se configura un perfil propio de moto, se utiliza ese perfil.

Sin `paraderoId`, mantiene el contrato existente de paraderos cercanos. La nueva operación devuelve un error si no hay ruta válida; nunca sustituye el trayecto por una línea recta.

## Despliegue

La función actualizada se desplegó el 3 de noviembre de 2026 en el proyecto enlazado, con autorización explícita del propietario. Supabase confirmó `Deployed Functions` y estado `ACTIVE`, versión 4, con los modos a pie y moto. La comprobación `db push --dry-run` confirmó que la base remota está al día y no hay migraciones pendientes; esta historia reutiliza las RPC existentes. Para futuros despliegues:

```sh
npx supabase functions deploy distancias-paraderos --remote=hjtaifvwshwjmzlhortg
```

El despliegue requiere autorización del propietario del proyecto. El código utiliza la conexión Supabase existente y el secreto GraphHopper ya configurado.

## Validación

- `npm run typecheck`: sin errores.
- `npm test`: 33 pruebas aprobadas.
- `npm test`: incluye pruebas del contrato, RLS/token, ejes GeoJSON, selección de perfil a pie/moto, perfiles propios, rechazo de modos inválidos, paradero inaccesible, fallo del proveedor y compatibilidad de la consulta de cercanos. Estas pruebas usan dobles del servidor y no demuestran conectividad con el proyecto remoto.
- El usuario confirmó el funcionamiento en su dispositivo y compartió capturas con rutas reales a pie y en moto.
- Comprobaciones manuales adicionales en Android/iOS: caminar al menos 50 metros, comprobar el recálculo automático y el límite de 30 segundos, ampliar/cerrar, mover/centrar el mapa, volver desde otra pantalla o segundo plano y reintentar con GPS o permisos deshabilitados.

Se consultó la documentación versionada de [Expo v57](https://docs.expo.dev/versions/v57.0.0/) y [Location v57](https://docs.expo.dev/versions/v57.0.0/sdk/location/) antes de implementar.
