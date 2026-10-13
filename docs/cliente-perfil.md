# Perfil del cliente y menú lateral

Este documento describe el trabajo de la rama `feature/XG-0011-Pantalla-perfil-cliente`: un menú lateral reutilizable (`SideBar`) con los datos del cliente y las pantallas de sus opciones, con datos de Supabase.

## Alcance implementado

### Menú lateral (`ClienteSideBar`)

- Se abre al tocar el avatar en **Inicio** o el botón de menú en **Rutas** y **Reservaciones**. Si hay notificaciones sin leer, el avatar y el botón muestran un punto rojo.
- Encabezado: avatar (foto de `usuarios.foto_perfil_url` o inicial), nombre completo, correo, etiqueta «Cliente» y estadísticas: viajes completados, reservaciones en curso y total de reservaciones.
- Opciones:
  - **Mi perfil** → `ClientePerfil`.
  - **Mis reservaciones** → `ClienteReservaciones` (indica cuántas hay en curso).
  - **Notificaciones** → `ClienteNotificaciones` (contador de no leídas).
  - **Seguridad** → `ClienteSeguridad`.
  - **Ayuda** → `ClienteAyuda`.
  - **Cerrar sesión** (al pie, con confirmación).

### Mi perfil (`ClientePerfilScreen`)

- Avatar, nombre, «Miembro desde» (`usuarios.fecha_registro`) y las mismas estadísticas del menú.
- Cuenta: correo y tipo de cuenta (solo lectura) y acceso a «Cambiar contraseña».
- Datos personales editables: nombre(s), apellidos, teléfono (obligatorios), edad (0 a 120) y dirección. El botón se activa solo si hay cambios.
- El teléfono se guarda también en `usuarios.numero_telefono`, igual que el perfil del taxista.
- Al guardar, el saludo de Inicio y el menú se actualizan.

### Notificaciones (`ClienteNotificacionesScreen`)

- Últimas 50 notificaciones de `notificaciones`, con ícono según el tipo y marca de no leída.
- Tocar una la marca como leída y, si tiene reserva, abre **Mis reservaciones**. El botón del encabezado marca todas.
- Llegan en tiempo real: la base las genera cuando el taxista acepta, rechaza, cancela o completa un viaje (`notificar_cambio_reserva`).

### Seguridad (`ClienteSeguridadScreen`)

- Cambio de contraseña con la contraseña actual, la nueva (mínimo 6 caracteres, como `minimum_password_length`) y su confirmación.
- Supabase no pide la contraseña actual (`secure_password_change = false`), así que la app la comprueba iniciando sesión con ella antes de llamar a `updateUser`.
- Para una contraseña olvidada se indica cerrar sesión y usar «¿Olvidaste tu contraseña?». No se envía el enlace desde aquí: con la sesión abierta, el enlace llegaría al navegador del cliente, que no tiene la pantalla de restablecer.

### Ayuda (`ClienteAyudaScreen`)

- Preguntas frecuentes desplegables sobre reservar, aceptación, cancelación, taxis cercanos, «No se presentó» y cómo editar el perfil.

## Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/components/SideBar.tsx` | **Componente reutilizable.** `SideBar` (panel animado a la izquierda o derecha, opciones con ícono, descripción, contador, estilo de peligro y opciones al pie) y `SideBarEncabezado` (avatar, nombre, subtítulo, etiqueta y contenido extra). No depende del rol. |
| `src/components/EncabezadoPantalla.tsx` | Encabezado azul con regreso y acción opcionales; `BotonEncabezado`. |
| `src/components/UserHeader.tsx` | Nuevo `indicador` (punto sobre el avatar) y etiqueta de accesibilidad. |
| `src/components/Icono.tsx` | Íconos del menú y del perfil. |
| `src/screens/cliente/ClienteContext.tsx` | Estado compartido del cliente: perfil, resumen de viajes, notificaciones y una suscripción en tiempo real a `notificaciones` y `reservas`. |
| `src/screens/cliente/ClienteSideBar.tsx` | Menú del cliente sobre `SideBar` y `BotonMenuCliente`. |
| `src/screens/cliente/Cliente{Perfil,Notificaciones,Seguridad,Ayuda}Screen.tsx` | Pantallas de las opciones. |
| `src/screens/cliente/useClienteInicio.ts` | Ya no carga el perfil: el nombre viene del contexto. |
| `src/infrastructure/supabase/repositories/cliente.repository.ts` | Perfil con datos de `usuarios`, guardado, resumen de viajes, notificaciones y canal en tiempo real. |
| `src/navigation/cliente/ClienteNavigator.tsx` | Cuatro pantallas nuevas dentro de `ClienteProvider`. |
| `supabase/migrations/20261016120000_perfil_cliente.sql` | Restringe las columnas editables de `usuarios` (ver «Seguridad»). |

Para reutilizar el menú en otro rol (p. ej. el taxista), basta con armar sus opciones y encabezado:

```tsx
<SideBar
  visible={visible}
  onClose={cerrar}
  opciones={[{ id: "perfil", label: "Mi perfil", icono: "person" }]}
  onSelect={(id) => ...}
  encabezado={<SideBarEncabezado titulo={nombre} subtitulo={correo} inicial="J" />}
/>
```

## Base de datos

No se necesitaron tablas ni funciones nuevas; todo usa las políticas existentes:

| Uso | Tabla y política |
| --- | --- |
| Leer y editar perfil | `clientes_ver_propio`, `clientes_actualizar_propio` |
| Correo, foto, fecha de registro y teléfono | `usuarios_ver_propio`, `usuarios_actualizar_propio` |
| Resumen de viajes | `reservas_cliente_ver` |
| Notificaciones y marcarlas leídas | `notificaciones_ver_propias`, `notificaciones_actualizar_propias` |

`notificaciones` y `reservas` ya estaban en la publicación `supabase_realtime`.

### Seguridad

`authenticated` tenía permiso de `UPDATE` en todas las columnas de `usuarios` y la política solo exige que la fila sea propia: **cualquier cliente o taxista podía cambiar su `rol_id` y volverse administrador**, además de su `correo` o `activo`. Se comprobó contra la base remota (en una transacción revertida).

La migración `20261016120000_perfil_cliente.sql` deja editables solo `numero_telefono` y `foto_perfil_url`. **No se ha aplicado a la base remota**; la app funciona igual con o sin ella.

## Límites actuales y pendientes

- **Sin foto de perfil editable.** Se muestra `foto_perfil_url` si existe, pero no hay bucket de Storage ni selector de imágenes.
- **Sin notificaciones push.** Las notificaciones llegan en tiempo real solo con la app abierta (igual que el taxista).
- **Calificaciones**: la tabla existe pero no hay flujo para calificar, por eso el perfil no muestra calificación.
- **El correo no se puede cambiar** desde la app (requiere confirmación por correo de Supabase Auth).
- `clientes_actualizar_propio` y `taxistas_actualizar_propio` también permiten editar cualquier columna propia (p. ej. `taxista_activo` o la ubicación del taxista sin pasar por las RPC). Es menos grave que el rol, pero conviene restringirlo igual.

## Validación realizada

- `npm run typecheck` pasó.
- `npx expo export --platform android` generó el bundle sin errores.
- Contra la base remota, en transacciones revertidas y como un cliente real bajo RLS:
  - El perfil con correo y fecha de registro se lee; la actualización de `clientes` y de `usuarios.numero_telefono` afecta 1 fila.
  - Solo ve sus notificaciones; marcarlas leídas afecta las suyas y 0 ajenas.
  - Con la migración, cambiar el teléfono funciona y cambiar `rol_id` o `activo` se rechaza; sin ella, cambiar `rol_id` funciona.
- PostgREST acepta la relación `clientes → usuarios!clientes_id_fkey`.
- **No se probó en un dispositivo.**
