# Mi ubicación y compartirla en tiempo real

La pestaña **Yo** del cliente muestra en el mapa dónde se encuentra y le permite compartir su ubicación en tiempo real con un familiar mediante un enlace. El familiar abre el enlace en el navegador, sin instalar la app ni tener cuenta.

## Flujo

1. Al abrir **Yo**, la app pide el permiso de ubicación y muestra al cliente en el mapa (marcador «Tú») con su dirección aproximada. La posición se actualiza mientras la pantalla está abierta.
2. El cliente elige cuánto tiempo compartir (30 min, 1 hora o 4 horas) y toca **Compartir ubicación**.
3. La app crea la ubicación compartida en Supabase y abre el menú para compartir del sistema (WhatsApp, SMS, etc.) con el mensaje y el enlace:
   `https://<página>/compartir/?id=<uuid>`.
4. Mientras está vigente, la app envía la posición al moverse 15 m (a lo más cada 10 s) y la reenvía cada minuto aunque el cliente no se mueva. **Enviar enlace** vuelve a abrir el menú para compartir; **Detener** la termina.
5. Al vencer, al detenerla o al iniciar otra, la página deja de mostrar la ubicación.

El envío vive en `ClienteContext` (`useCompartirUbicacion`): sigue funcionando aunque el cliente cambie de pantalla, y al volver a abrir la app retoma la ubicación compartida que siga vigente.

**Solo funciona con la app abierta** (igual que la ubicación del taxista). Con la app en segundo plano no se envía nada; al volver, se envía de inmediato. Si la última ubicación tiene más de 3 minutos, la página avisa que el cliente pudo cerrar la app o quedarse sin internet.

## Base de datos

Migración [20261025120000_compartir_ubicacion_cliente.sql](../supabase/migrations/20261025120000_compartir_ubicacion_cliente.sql).

Tabla `ubicaciones_compartidas`: `cliente_id`, `ubicacion`, `ubicacion_actualizada_en`, `expira_en` y `finalizada_en`. Tiene RLS sin políticas y sin permisos directos: todo pasa por las RPC.

| RPC | Rol | Qué hace |
|---|---|---|
| `iniciar_ubicacion_compartida(lat, lon, minutos)` | `authenticated` | Termina la activa del cliente y crea otra (15 min a 8 h). Devuelve `id` y `expira_en`. |
| `actualizar_ubicacion_compartida(id, lat, lon)` | `authenticated` | Guarda la posición. Devuelve `false` si ya venció o se detuvo. |
| `detener_ubicacion_compartida(id)` | `authenticated` | La termina. |
| `obtener_ubicacion_compartida_activa()` | `authenticated` | La vigente del cliente, para retomar el envío. |
| `obtener_ubicacion_compartida(id)` | `anon` | Para la página: primer nombre, `activa`, coordenadas y fechas. Sin coordenadas si ya no está activa. |

El `id` es un uuid aleatorio y funciona como llave del enlace: quien lo tenga ve la ubicación mientras esté vigente. Por eso la página solo recibe el primer nombre del cliente.

## Página web

[web/compartir/index.html](../web/compartir/index.html) es una página estática: consulta `obtener_ubicacion_compartida` por la API REST cada 10 s (se pausa si la pestaña está oculta) y dibuja la posición con Leaflet y los mosaicos de OpenStreetMap, que no necesitan API key. Tiene un enlace para abrir el punto en Google Maps.

Las Edge Functions de Supabase no sirven HTML, así que la página se publica en GitHub Pages con el flujo [.github/workflows/pagina-ubicacion.yml](../.github/workflows/pagina-ubicacion.yml), que reemplaza `__SUPABASE_URL__` y `__SUPABASE_PUBLISHABLE_KEY__` al publicar.

### Configuración

1. Aplica la migración: `npx supabase db push`.
2. En GitHub, en *Settings → Pages*, elige **GitHub Actions** como fuente. (En un repositorio privado, Pages requiere un plan de pago.)
3. En *Settings → Secrets and variables → Actions → Secrets*, crea `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` con los mismos valores del `.env`. La key publicable termina visible en la página publicada, y no pasa nada: la seguridad depende de las RPC.
4. Ejecuta el flujo (se ejecuta solo al subir cambios de `web/` a `master`, o a mano desde *Actions*).
5. En el `.env` de la app pon la URL de la página, sin `?id=`:
   ```env
   EXPO_PUBLIC_URL_UBICACION_COMPARTIDA=https://carlosamcisc.github.io/XimbalGo/compartir
   ```
   Al ser una variable `EXPO_PUBLIC_`, reinicia Metro para que la tome. Si falta, la app no empieza a compartir y lo avisa.

Para probar la página en local, reemplaza los dos valores en una copia del HTML y ábrela con `?id=<uuid>`.

## Archivos

| Archivo | Contenido |
|---|---|
| [ClienteYoScreen.tsx](../src/screens/cliente/ClienteYoScreen.tsx) | Pantalla con el mapa y la tarjeta para compartir |
| [useClienteYo.ts](../src/screens/cliente/useClienteYo.ts) | Ubicación y dirección del cliente para el mapa |
| [useCompartirUbicacion.ts](../src/screens/cliente/useCompartirUbicacion.ts) | Inicia, envía, retoma y detiene la ubicación compartida |
| [ubicacionCompartida.repository.ts](../src/infrastructure/supabase/repositories/ubicacionCompartida.repository.ts) | Llamadas a las RPC |
| [ubicacionCompartida.ts](../src/modules/cliente/ubicacionCompartida.ts) | Tipos, duraciones, enlace y mensaje |
| [MapaSeguimiento.tsx](../src/components/MapaSeguimiento.tsx) | Marcador «Tú»; la leyenda muestra solo los marcadores que recibe |

## Pendiente

- Envío en segundo plano (pantalla bloqueada): requiere `expo-task-manager`, el servicio en primer plano de Android y el permiso de ubicación «todo el tiempo».
