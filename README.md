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
| Mapa | Google Maps nativo con `react-native-maps` (Maps SDK for Android e iOS; Apple Maps en iOS si no hay key) |
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
   GOOGLE_MAPS_ANDROID_API_KEY=
   GOOGLE_MAPS_IOS_API_KEY=
   EXPO_PUBLIC_URL_UBICACION_COMPARTIDA=
   ```
3. Configura la key de Google Maps (ver [Google Maps](#google-maps)).
4. En Supabase, agrega `ximbalgo://recuperar-contrasena` a las URLs de redirección permitidas de Auth para que funcione la recuperación de contraseña.
5. Para aplicar migraciones pendientes, revisa primero el proyecto enlazado:
   ```bash
   npx supabase migration list
   npx supabase db push
   ```

### Google Maps

El mapa usa Google Maps nativo con `react-native-maps`. Cada plataforma lleva su propia key porque Google las restringe distinto.

#### Android

1. En Google Cloud, en el proyecto de la app, habilita **Maps SDK for Android**.
2. En *Credenciales*, restringe la API key:
   - **Restricción de aplicación**: *Apps para Android*, con el paquete `com.carlosmay.XimbalGo` y la huella SHA-1 de cada keystore que firme la app. La del keystore de debug (también firma el release mientras no haya uno propio) se obtiene con `cd android && ./gradlew signingReport`.
   - **Restricción de API**: solo *Maps SDK for Android*.
3. Pon la key en `GOOGLE_MAPS_ANDROID_API_KEY` del `.env`. [app.config.ts](./app.config.ts) la lee al compilar y el plugin de `react-native-maps` la escribe en el `AndroidManifest.xml`; no lleva el prefijo `EXPO_PUBLIC_` porque la app no la usa en JavaScript.
4. Regenera la carpeta nativa y compila: `npx expo prebuild --platform android --clean` y `npm run android`.

Si el mapa sale gris, revisa `adb logcat | grep -i "maps"`: casi siempre es la SHA-1 o el paquete de la restricción.

#### iOS

1. En el mismo proyecto de Google Cloud, habilita **Maps SDK for iOS**.
2. Crea otra API key con:
   - **Restricción de aplicación**: *Apps para iOS*, con el bundle identifier `com.carlosmay.XimbalGo`.
   - **Restricción de API**: solo *Maps SDK for iOS*.
3. Ponla en `GOOGLE_MAPS_IOS_API_KEY`. El plugin de `react-native-maps` la escribe en el `Info.plist` e instala el SDK de Google Maps en el `Podfile`.

Sin `GOOGLE_MAPS_IOS_API_KEY` la app también compila: en iOS el mapa usa Apple Maps. [app.config.ts](./app.config.ts) avisa a [MapaSeguimiento.tsx](./src/components/MapaSeguimiento.tsx) con `extra.googleMapsIos` cuál proveedor quedó instalado, porque pedir Google Maps sin su SDK hace fallar el mapa.

### iOS

En Windows no se puede compilar para iOS de forma local (`npm run ios` requiere macOS y Xcode). Se compila en la nube con EAS Build usando los perfiles de [eas.json](./eas.json):

1. Instala EAS CLI e inicia sesión con la cuenta de Expo: `npm install -g eas-cli` y `eas login`.
2. Enlaza el proyecto la primera vez: `eas init`.
3. Sube las variables del `.env` a EAS, porque el `.env` no se sube al repositorio ni a EAS. Para cada variable y cada ambiente (`development`, `preview`, `production`): `eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value ... --environment development`. Las `EXPO_PUBLIC_*` pueden ser visibilidad *plaintext*; las keys de Maps, *sensitive*.
4. Compila para el simulador de iOS (no requiere cuenta de Apple Developer): `eas build -p ios --profile development`. El simulador solo corre en macOS: en una Mac, instálalo con `eas build:run -p ios` o arrastra el `.app` del `.tar.gz` descargado al simulador.

Para instalar en un iPhone físico o publicar en App Store se necesita una cuenta de Apple Developer: se registra el dispositivo con `eas device:create` y se compila con un perfil sin `"simulator": true`.

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
