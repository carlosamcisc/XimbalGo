# XímbalGo

XímbalGo es una aplicación móvil diseñada para mejorar la experiencia de los usuarios del transporte público en comunidades donde no existe información centralizada sobre rutas, horarios y disponibilidad de unidades.

La app conecta a **clientes** que buscan un taxi colectivo con **taxistas** que cubren rutas fijas: el cliente ve taxis y paraderos cercanos, reserva asientos y sigue al taxi en tiempo real; el taxista comparte su ubicación, recibe solicitudes y administra su vehículo.

## Funcionalidades

### Autenticación
- Pantalla de bienvenida (solo la primera vez), inicio de sesión y registro con selección de rol (cliente o taxista).
- El taxista elige su ruta del catálogo al registrarse.
- Recuperación de contraseña por correo con enlace profundo `ximbalgo://recuperar-contrasena`.
- Al iniciar sesión, la app abre la navegación correspondiente al rol: cliente, taxista o administrador.

### Cliente
- **Inicio**: origen (GPS o punto de una ruta) y destino, taxis y paraderos cercanos calculados con PostGIS.
- **Taxis**: lista completa de taxis en servicio con asientos libres, buscador y actualización en tiempo real.
- **Reservar**: número de asientos, viaje inmediato o programado (próximos 7 días), notas y total.
- **Detalle de reservación**: hora estimada de llegada, distancia, mapa con el taxi en vivo y cancelación.
- **Reservaciones**: en curso e historial, actualizadas en tiempo real.
- **Rutas**: catálogo de rutas con precio, taxistas en servicio y asientos libres.
- **Paraderos**: lista completa y detalle con foto, referencia y apertura en la app de mapas.
- **Yo**: el cliente se ve en el mapa y comparte su ubicación en tiempo real con un familiar mediante un enlace web.
- **Menú lateral**: perfil, notificaciones, seguridad (cambio de contraseña), ayuda y cierre de sesión.

### Taxista
- **Inicio**: iniciar/terminar servicio, envío periódico de ubicación y solicitudes pendientes.
- **Viajes**: aceptar, rechazar, completar, marcar «no se presentó» o cancelar.
- **Vehículo**: registro, edición y mapa de asientos en tiempo real.
- **Perfil**: datos personales, ruta, horario y precio por pasajero.

### Administrador
- Solo existe la pantalla de inicio provisional.

## Tecnologías

| Área | Herramienta |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19, TypeScript |
| Navegación | React Navigation 7 (native stack) |
| Backend | Supabase: Auth, Postgres + PostGIS, RLS, RPC y Realtime |
| Ubicación | `expo-location` |
| Mapa | MapLibre Native con OpenFreeMap (datos de OpenStreetMap), sin API key |
| Animaciones | `lottie-react-native` |
| Sesión local | `@react-native-async-storage/async-storage` |

> Expo cambió en las versiones recientes. Antes de escribir código revisa la documentación de la versión usada: https://docs.expo.dev/versions/v57.0.0/

## Requisitos

- Node.js y npm.
- Android Studio con un emulador o un dispositivo Android con depuración USB.
- Para iOS: una Mac con Xcode, o una cuenta de Expo para compilar en la nube con EAS Build (ver [iOS](#ios)).
- Un proyecto de Supabase con las migraciones de [supabase/migrations/](./supabase/migrations/) aplicadas.

El proyecto usa `expo-dev-client` y módulos nativos (ubicación, mapas, Lottie), por lo que **no funciona en Expo Go**: se ejecuta como build de desarrollo.

## Configuración

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia [.env.example](./.env.example) a `.env` y completa las variables (no subas el `.env` al repositorio):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   EXPO_PUBLIC_URL_UBICACION_COMPARTIDA=
   ```
3. Revisa [Mapas y rutas](#mapas-y-rutas): el mapa no necesita clave; GraphHopper se configura en Supabase.
4. En Supabase, agrega `ximbalgo://recuperar-contrasena` a las URLs de redirección permitidas de Auth para que funcione la recuperación de contraseña.
5. Para aplicar migraciones pendientes, revisa primero el proyecto enlazado:
   ```bash
   npx supabase migration list
   npx supabase db push
   ```

### Mapas y rutas

Android e iOS usan [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/expo/) con el estilo Liberty de [OpenFreeMap](https://openfreemap.org/). Los mapas no necesitan cuenta ni API key. La atribución a OpenStreetMap y OpenMapTiles permanece accesible en el control del mapa.

- [MapaSeguimiento.tsx](./src/components/MapaSeguimiento.tsx) muestra taxi, cliente, abordaje y paradero. Actualiza los marcadores sin recentrar mientras el usuario explora; el botón de centrar encuadra los puntos actuales.
- [app.config.ts](./app.config.ts) instala el plugin nativo de MapLibre. Después de instalar las dependencias hay que generar un nuevo cliente nativo: un build anterior no incluye MapLibre.
- En Android, regenera con `npx expo prebuild --platform android --clean` y compila con `npm run android`. Las carpetas nativas son generadas y no se versionan.
- En iOS, genera una compilación con EAS o usa macOS y Xcode (ver más abajo).
- La página de ubicación compartida usa MapLibre GL JS con OpenFreeMap. Los enlaces de navegador abren OpenStreetMap; el botón de la app intenta primero abrir la aplicación de mapas del dispositivo.
- Las claves antiguas de Maps ya no se leen y pueden quitarse del `.env` y de EAS.

**GraphHopper** sigue calculando distancias y tiempos a paraderos desde la Edge Function `distancias-paraderos`. Su clave va como secreto `GRAPHHOPPER_API_KEY` en Supabase, nunca en el cliente. Ver [configuración y límites](./docs/distancias-paraderos.md). El plan gratuito tiene 500 créditos diarios para uso no comercial; la caché reduce llamadas y, si falla el servicio o se agota la cuota, se muestran distancias en línea recta sin tiempos. Mover el mapa y actualizar marcadores no llama a GraphHopper.

Esta migración conserva las funciones actuales: el seguimiento muestra posiciones; no añade navegación giro a giro ni una línea de ruta por calles.

### iOS

En Windows no se puede compilar para iOS de forma local (`npm run ios` requiere macOS y Xcode). Se compila en la nube con EAS Build usando los perfiles de [eas.json](./eas.json):

1. Instala EAS CLI e inicia sesión con la cuenta de Expo: `npm install -g eas-cli` y `eas login`.
2. Enlaza el proyecto la primera vez: `eas init`.
3. Sube las variables del `.env` a EAS, porque el `.env` no se sube al repositorio ni a EAS. Para cada variable y cada ambiente (`development`, `preview`, `production`): `eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value ... --environment development`. Las `EXPO_PUBLIC_*` pueden ser visibilidad *plaintext*. La clave de GraphHopper permanece en Supabase.
4. Compila para el simulador de iOS (no requiere cuenta de Apple Developer): `eas build -p ios --profile development`. El simulador solo corre en macOS: en una Mac, instálalo con `eas build:run -p ios` o arrastra el `.app` del `.tar.gz` descargado al simulador.

Para distribuir con EAS mediante TestFlight, App Store o instalación ad hoc se necesita la membresía Apple Developer. Para ad hoc, registra el dispositivo con `eas device:create` y usa un perfil sin `"simulator": true`.

#### IPA sin firma para uso personal

El perfil `ios-unsigned` compila una app de iPhone en modo Release en los servidores macOS de EAS y genera `app.ipa` sin certificados de Apple. La configuración está en [.eas/build/ios-unsigned.yml](./.eas/build/ios-unsigned.yml) y el empaquetado en [scripts/build-ios-unsigned.cjs](./scripts/build-ios-unsigned.cjs). Incluye el bundle JavaScript para funcionar sin Metro. Este perfil no genera un build de simulador ni envía la app a App Store.

Desde PowerShell, en la carpeta del proyecto:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest init
```

`init` se ejecuta solo al enlazar el proyecto por primera vez. En el panel del proyecto en Expo, crea estas variables en el ambiente **production**, con los valores de tu `.env`:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_URL_UBICACION_COMPARTIDA
```

Las tres pueden tener visibilidad `plaintext`: son configuración pública del cliente. La clave de GraphHopper se conserva como secreto de Supabase. El script detiene la compilación si faltan estas variables, sin imprimir sus valores.

Para generar el IPA:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile ios-unsigned
```

Al finalizar, descarga `app.ipa` desde el enlace del build de EAS. No se necesita una membresía Apple Developer para esta compilación sin firma; requiere una cuenta de Expo y cuota de compilación disponible. El archivo todavía debe firmarse antes de instalarlo.

Para uso personal desde Windows, [Sideloadly](https://sideloadly.io/) permite firmar e instalar el IPA con una cuenta gratuita de Apple. Conecta el iPhone por USB, confía en la computadora, carga el IPA en Sideloadly y sigue sus pasos de firma e instalación. La cuenta de Apple se introduce en esa herramienta, nunca en el repositorio ni en las variables de EAS. Activa el modo desarrollador del iPhone si el sistema lo solicita. Con una cuenta gratuita la firma caduca a los siete días y debe renovarse para continuar usando la app.

Validación disponible desde Windows: sintaxis del script y lectura de JSON/YAML. La compilación nativa y el funcionamiento en iPhone deben comprobarse con el primer build de EAS y la instalación del IPA firmado.

Referencias: [compilaciones personalizadas](https://docs.expo.dev/custom-builds/get-started/), [withoutCredentials](https://docs.expo.dev/eas/json/#withoutcredentials) y [Sideloadly](https://sideloadly.io/).

Detalles de iOS que ya resuelve el código:

- **Toasts**: iOS no tiene `ToastAndroid`. [ToastMessaje.tsx](./src/components/ToastMessaje.tsx) dibuja su propio toast con `ToastHost` (montado en [App.tsx](./App.tsx)) dentro de un `FullWindowOverlay`, para que se vea aunque haya un `Modal` abierto. Usa siempre `ToastMessage.show`, nunca `ToastAndroid`.
- **Sombras**: `elevation` solo funciona en Android. Junto a `elevation` van `shadowColor`, `shadowOpacity`, `shadowRadius` y `shadowOffset`.
- **Fuentes**: con Inter el peso va en `fontFamily` (`InterMedium`, `InterSemiBold`, `InterBold`) o en la prop `weight` de `AppText`, nunca en `fontWeight`: iOS cambia a la fuente del sistema si se combinan.
- **Ícono**: [assets/app-icon.png](./assets/app-icon.png) es cuadrado (1024×1024) y sin transparencia, como lo exige iOS.

## Ejecución del proyecto

| Acción | Comando |
|---|---|
| Compilar e instalar el build de desarrollo en Android | `npm run android` (equivale a `npx expo run:android`) |
| Compilar el build de desarrollo para el simulador de iOS (en la nube) | `eas build -p ios --profile development` |
| Compilar e instalar en iOS desde una Mac | `npm run ios` (equivale a `npx expo run:ios`) |
| Iniciar solo el servidor de Metro (con el build ya instalado) | `npm start` |
| Generar e instalar el APK de release | `npx expo run:android --variant release` |
| Verificar tipos | `npm run typecheck` |
| Ejecutar pruebas de mapas y ubicación | `npm test` |
| Regenerar la carpeta nativa `android/` | `npx expo prebuild --platform android --clean` |

Nota: la carpeta nativa solo se regenera si hubo cambios en módulos nativos , en [app.json](./app.json) o en [app.config.ts](./app.config.ts). Las carpetas `android/` e `ios/` no se versionan.

## Arquitectura del proyecto

```plaintext
assets/
├── bienvenida/          # Imagen de la pantalla de bienvenida
├── fonts/               # Tipografía Inter
├── lotties/             # Animaciones Lottie
└── icon.png, splash-icon.png, favicon.png

docs/                    # Documentación de cada funcionalidad

src/
├── components/          # Componentes reutilizables (botones, tarjetas, selectores, mapa, SideBar...)
├── infrastructure/
│   ├── location/        # Servicio de ubicación del dispositivo
│   └── supabase/
│       ├── auth/        # Inicio de sesión, registro, recuperación y enlaces profundos
│       ├── realtime/    # Suscripciones en tiempo real
│       ├── repositories/# Consultas y RPC por dominio (cliente, reservas, rutas, taxista...)
│       ├── storage/     # Servicio de Storage
│       ├── client.ts    # Cliente de Supabase tipado
│       └── database*.types.ts  # Tipos generados de la base y de las RPC
├── modules/             # Tipos y lógica de dominio por rol (auth, cliente, taxista, usuarios, administrador)
├── navigation/
│   ├── RootNavigator.tsx  # Elige la navegación según la sesión y el rol
│   ├── autenticacion/
│   ├── cliente/
│   ├── taxista/
│   ├── aministrador/
│   └── types.ts           # Parámetros de cada pila
├── screens/             # Pantallas por rol; la lógica vive en hooks use*.ts y los datos compartidos en *Context.tsx
├── store/               # Estado global de autenticación
└── theme/
    └── colors.ts        # Paleta y tokens de color

supabase/
├── config.toml
└── migrations/          # Funciones RPC, políticas RLS y cambios de esquema
```

Reglas a seguir:
- Las pantallas no construyen consultas: usan los repositorios de `src/infrastructure/supabase/repositories/`.
- La lógica de cada pantalla va en su hook (`useCliente*.ts`) y la presentación en el componente `*Screen.tsx`.
- Los colores se toman de `src/theme/colors.ts` y el texto se muestra con `AppText`.

*Recuerden seguir la arquitectura del proyecto.*

## Diseño

### Fuentes
| Fuente | Pesos | Uso |
|---|---|---|
| **Inter** | Regular, Medium, SemiBold, Bold | Toda la aplicación, mediante el componente `AppText` |

### Colores principales
| Token | Color | Uso |
|---|---|---|
| `primary` | `#0066FF` | Botones y acciones destacadas |
| `secondary` | `#00D1FF` | Bordes, acentos y detalles |
| `brandDeep` | `#0F2D5B` | Encabezados y textos principales |
| `tertiary` | `#94A3B8` | Información secundaria e íconos inactivos |

## Documentación de funcionalidades

- [Pantalla de inicio del cliente](./docs/cliente-inicio.md): interfaz, flujo GPS, búsqueda de taxis y paraderos cercanos, origen y destino desde las rutas.
- [Reservaciones del cliente](./docs/cliente-reservaciones.md): lista en curso e historial, cancelación y tiempo real.
- [Rutas del cliente](./docs/cliente-rutas.md): catálogo de rutas, `ruta_id` de los taxistas y registro del taxista.
- [Perfil del cliente y menú lateral](./docs/cliente-perfil.md): perfil, notificaciones, seguridad y ayuda.
- [Información de paradero](./docs/cliente-paraderos.md): detalle y lista completa de paraderos.
- [Reservar asientos y seguimiento del taxi](./docs/cliente-reservar-asientos.md): varios asientos, viajes programados y seguimiento en tiempo real.
- [Mi ubicación y compartirla en tiempo real](./docs/cliente-compartir-ubicacion.md): mapa del cliente, enlace para un familiar y página web en GitHub Pages.
- [Pantallas del taxista](./docs/taxista.md): servicio, ubicación, viajes, vehículo y perfil.
- [Opciones del taxista sobre solicitudes y asientos](./docs/taxista-opciones-solicitudes.md): asientos ocupados sin reserva, motivo de rechazo y oferta de los asientos que quedan.
