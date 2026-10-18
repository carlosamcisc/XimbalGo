# Registro de clientes y taxistas

Este documento describe el trabajo de la rama `feature/XG-0015-Correccion-registro-roles`: correcciones para que los datos del registro se guarden completos y con el formato de la base de datos.

## Cómo se guarda un registro

`RegistroScreen` llama a `registrarUsuario`, que envía los datos como metadata de `supabase.auth.signUp`. El trigger `on_auth_user_created` ejecuta `handle_new_user`, que crea la fila en `usuarios` y otra en `clientes` (rol 3) o `taxistas` (rol 2). Si `handle_new_user` falla, Supabase no crea la cuenta y responde «Database error saving new user».

## Problemas encontrados

| Problema | Efecto |
| --- | --- |
| El formulario no limitaba el largo de los campos. `nombres` y `apellidos` son `varchar(100)`, `telefono` es `varchar(20)` y `horario_trabajo` es `varchar(100)`. | Un dato más largo hacía fallar el registro completo. |
| El teléfono no se validaba. | Se aceptaba cualquier texto. |
| La ruta del taxista era opcional. | Un taxista sin ruta no aparece a los clientes (`obtenerTaxistasConRuta` filtra por `punto_partida`) ni puede iniciar servicio. |
| Si el taxista borraba el precio, `precio_ruta` quedaba `null`. | Sus reservas se creaban sin precio. |
| El precio con coma (`25,50`) se rechazaba, y con más de 2 decimales se redondeaba sin aviso. | |
| `handle_new_user` convertía la edad y el precio con `::int` y `::decimal`. | Un valor que no fuera número rechazaba toda la cuenta. |
| Los textos se guardaban sin quitar espacios. | Una dirección con solo espacios quedaba guardada. |
| La contraseña se registraba tal cual, pero `InicioSesionScreen` quita los espacios de los extremos. | Una contraseña con espacios al final no permitía iniciar sesión. |
| Los errores de Supabase llegaban en inglés. | |

## Cambios

### App

- `RegistroScreen`: nueva función `validar` (como en `ClientePerfilScreen`) que:
  - Limita los campos con `maxLength` según las columnas.
  - Valida el teléfono (`+`, números, espacios o guiones; de 7 a 20 caracteres).
  - Exige al menos 6 caracteres de contraseña y sin espacios en los extremos.
  - Valida la edad de 1 a 120.
  - Exige la ruta al taxista. Acepta el precio con coma o punto y hasta 2 decimales. Si el precio queda vacío, el campo indica la tarifa base.
- `TextInputField`: nueva propiedad `maxLength`.
- `registrarUsuario`: traduce los errores de Supabase por su `code` y detecta un correo repetido cuando la confirmación de correo está activa (Supabase devuelve un usuario sin identidades en vez de un error).

### Base de datos (`20261022120000_registro_usuarios.sql`)

`handle_new_user` ahora:

- Quita espacios a los textos y guarda `null` en vez de textos vacíos.
- Ignora la edad o el precio si no son números válidos, en vez de rechazar la cuenta.
- Usa `rutas.precio_base` cuando el taxista no indica precio.
- Ya no lee `punto_partida` ni `punto_destino` de la metadata: `trigger_sincronizar_ruta_taxista` los copia de la ruta.

La migración también asigna la tarifa base a los taxistas que ya tenían ruta y no tenían precio.

## Validación realizada

- `npm run typecheck` pasó.
- La función nueva se ejecutó contra la base remota en una transacción revertida, con dos taxistas y dos clientes simulados:
  - Nombres, teléfono y horario con espacios se guardan limpios; una dirección con solo espacios queda `null`.
  - Un taxista sin precio toma la tarifa base de su ruta; uno con precio guarda el suyo. Ambos tienen `ruta_id` y `punto_partida`.
  - Un cliente con edad `abc` se registra con edad `null`; uno con edad 30 la guarda.
  - Después de la prueba no quedaron usuarios ni cambios en la función.
- **No se probó en un dispositivo.**
