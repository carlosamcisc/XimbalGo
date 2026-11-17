# XG-0029: selección del taxi y distancias

La lista de taxis filtra por el origen y destino seleccionados. La pantalla
de reserva bloquea un taxi incompatible, incluso cuando se entra desde los
taxis cercanos de Inicio. Antes de enviar, vuelve a consultar la ruta.
La migración `20261105130000_validar_trayecto_reserva.sql` aplica la misma
validación en `crear_reserva_cliente`, antes de bloquear asientos.

Los nombres se comparan sin diferencias de mayúsculas, acentos o espacios.
El sentido de la ruta cuenta: A → B no permite reservar B → A.
Con GPS o un paradero como origen se valida el destino, porque el modelo
actual no relaciona esos puntos con las rutas. Esto no garantiza cobertura
geográfica del punto de abordaje.

Se solicita precisión alta al GPS del cliente y del taxista, tanto en primer
como en segundo plano. Inicio vuelve a consultar cercanos cuando cambian
los taxistas o asientos, para reflejar la posición recibida del servidor.
La distancia sigue siendo en línea recta, calculada por PostGIS en metros.
La precisión y antigüedad de las coordenadas pueden afectar el resultado;
no se fuerza una distancia cero cuando dos dispositivos reportan puntos distintos.

## Verificación

`npm.cmd test` y `npm.cmd run typecheck`.

El 5 de noviembre de 2026 pasaron las 49 pruebas y la comprobación de
TypeScript. La migración se aplicó al proyecto enlazado
`hjtaifvwshwjmzlhortg`; una segunda ejecución con `--dry-run` confirmó que
la base remota está al día. La prueba física con dos dispositivos sigue pendiente.

En una base de pruebas, aplicar la migración y verificar que una llamada
directa a `crear_reserva_cliente` con un taxi de otro origen o destino falla
sin crear reserva ni apartar asientos. Probar también una reserva compatible
de varios asientos, GPS, paradero y un taxi sin `ruta_id` con trayecto registrado.

En dos dispositivos, poner al taxista en servicio, acercarlo al cliente y
verificar que Inicio actualiza la distancia sin recargar. Repetir con la app
del taxista en segundo plano y con ambos dispositivos en el mismo punto.
