# Recuperación de contraseña

Este documento describe la corrección del flujo «¿Olvidaste tu contraseña?»: al abrir el enlace del correo, la app entraba directo a la cuenta en vez de mostrar la pantalla para crear una contraseña nueva.

## Cómo funciona el enlace

`RecuperarContraseniaScreen` llama a `resetPasswordForEmail` con `redirectTo: ximbalgo://recuperar-contrasena`. Al abrir el enlace, `prepararEnlaceAutenticacion` (`auth.deep-link.ts`) canjea el código (`exchangeCodeForSession`) o los tokens (`setSession`) y navega a `restablecer-contrasena?recovery=verified`. Supabase solo permite `updateUser({ password })` con una sesión abierta, así que el enlace siempre abre una sesión.

## Problemas encontrados

| Problema | Efecto |
| --- | --- |
| La sesión del enlace se trataba como un inicio de sesión normal. Con la app cerrada, `getInitialURL` canjea el código antes de que monte `RootNavigator`; `inicializarAutenticacion` encontraba la sesión, leía el rol y `RootNavigator` mostraba `ClienteNavigator`, `TaxistaNavigator` o `AdminNavigator`. | `RestablecerContrasenia` solo existe en `AutenticacionNavigator`, así que el usuario terminaba en el inicio con la cuenta abierta. |
| Después de cambiar la contraseña no se cerraba la sesión. | La pantalla decía «Ya puedes iniciar sesión», pero al reabrir la app se entraba sin escribir la contraseña nueva. |
| Salir de la pantalla con «Atrás» tampoco cerraba la sesión. | Lo mismo: la cuenta quedaba abierta. |

## Cambios

- `autenticacionStore`: nuevo estado `recuperandoContrasena`, guardado también en AsyncStorage (`@ximbalgo/recuperacion-pendiente`).
  - `iniciarRecuperacionContrasena` lo activa. Se llama desde `prepararEnlaceAutenticacion` antes de abrir la sesión, y cuando llega el evento `PASSWORD_RECOVERY`.
  - `cancelarRecuperacionContrasena` lo desactiva si el enlace no es válido.
  - `finalizarRecuperacionContrasena` cierra la sesión (si el servidor no responde, la borra del dispositivo) y desactiva el estado.
  - Mientras está activo no se lee el rol. Si la app se cerró a mitad de la recuperación, al abrirla se retoma el cambio de contraseña.
- `RootNavigator`: con `recuperandoContrasena` muestra `AutenticacionNavigator` en `RestablecerContrasenia`, aunque haya sesión o rol.
- `RestablecerContraseniaScreen`: toma el enlace como válido con `recovery=verified` o con `recuperandoContrasena`. Cierra la sesión al guardar la contraseña y al salir de la pantalla (`beforeRemove`: botón «Atrás», gesto o botón del sistema).

## Validación realizada

- `tsc --noEmit` pasó.
- **No se probó en un dispositivo.**
