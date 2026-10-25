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
| Framework | Expo SDK 58, React Native 0.88, React 19.3, TypeScript |
| Navegación | React Navigation 7 (native stack) |
| Backend | Supabase: Auth, Postgres + PostGIS, RLS, RPC y Realtime |
| Ubicación | `expo-location` |
| Mapa | Leaflet + OpenStreetMap dentro de `react-native-webview` (compatible con Expo Go) |
| Animaciones | `lottie-react-native` |
| Sesión local | `@react-native-async-storage/async-storage` |

> Expo cambió en las versiones recientes. Antes de escribir código revisa la documentación de la versión usada: https://docs.expo.dev/versions/v58.0.0/

## Requisitos

- Node.js y npm.
- Expo Go instalado en el iPhone o teléfono Android.
- Node.js 22.13 o superior (requerido por Expo SDK 58).
- Un proyecto de Supabase con las migraciones de [supabase/migrations/](./supabase/migrations/) aplicadas.

El proyecto usa Expo Managed y está preparado para Expo Go. No requiere Xcode, macOS, Android Studio ni compilar código nativo.

## Configuración

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia [.env.example](./.env.example) a `.env` y completa las variables (no subas el `.env` al repositorio):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```
3. En Supabase, agrega `ximbalgo://recuperar-contrasena` a las URLs de redirección permitidas de Auth para que funcione la recuperación de contraseña.
4. Para aplicar migraciones pendientes, revisa primero el proyecto enlazado:
   ```bash
   npx supabase migration list
   npx supabase db push
   ```

### Mapa y ubicación

El mapa nativo de Google (`react-native-maps`) y su API key Android se reemplazaron por Leaflet y teselas de OpenStreetMap servidos dentro de `react-native-webview`, que Expo Go incluye para iOS y Android. Conserva taxi, abordaje, paradero, centrado y actualización de posiciones. Se requiere conexión a internet para cargar Leaflet y las teselas. `expo-location` sigue pidiendo permiso de ubicación en primer plano; el seguimiento del taxista continúa mientras la app está abierta. No se solicita ubicación en segundo plano.

## Ejecución del proyecto

| Acción | Comando |
|---|---|
| Iniciar Expo Go | `npx expo start` |
| Abrir Expo Go en Android conectado | `npx expo start --android` |
| Abrir simulador iOS (requiere Mac) | `npx expo start --ios` |
| Verificar tipos | `npm run typecheck` |

### Abrir en iPhone con Expo Go

1. Instala Expo Go desde App Store en el iPhone y conecta el iPhone y la computadora a la misma red Wi-Fi.
2. Instala dependencias (`npm install`) y configura `.env` con las variables de Supabase indicadas arriba.
3. Ejecuta `npx expo start` en la carpeta del proyecto.
4. Escanea con la cámara del iPhone el QR que muestra Expo. Confirma abrirlo en Expo Go y acepta el permiso de ubicación cuando la app lo solicite.
5. Si la red local bloquea el QR, ejecuta `npx expo start --tunnel` y escanea el nuevo QR.

En Android, instala Expo Go desde Google Play y sigue los mismos pasos; también puedes usar `npx expo start --android` para abrirlo en un dispositivo conectado.

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
- [Pantallas del taxista](./docs/taxista.md): servicio, ubicación, viajes, vehículo y perfil.
- [Opciones del taxista sobre solicitudes y asientos](./docs/taxista-opciones-solicitudes.md): asientos ocupados sin reserva, motivo de rechazo y oferta de los asientos que quedan.
