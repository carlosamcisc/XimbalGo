# Mapa y ubicación del cliente para el taxista

Se implementa en la rama `feat/cliente-reserva-ruta-taxista`.

## Uso

En Inicio, «Mi recorrido» muestra el taxi y el recorrido por calles hacia un
paradero seleccionado. «Paraderos de mi ruta» permite marcar hasta 30 paraderos
activos en el orden en que pasa el conductor. La selección se guarda por
conductor y ruta: no modifica las selecciones de otros conductores. Al cambiar
de ruta se usa su configuración correspondiente. No se infiere pertenencia por
cercanía ni por coincidencias de nombres.

La lista de paraderos permite cambiar el destino del tramo. El mapa puede
ampliarse y abrir el paradero en la aplicación externa de mapas. GraphHopper
calcula un trayecto sugerido en auto desde la última posición del taxi hasta
ese paradero. No es navegación con instrucciones de giro, ni un historial GPS,
ni garantiza seguir todas las calles de una ruta oficial. No se dibuja una
línea que una paraderos en línea recta. Los paraderos se muestran en el orden
configurado; el conductor selecciona el tramo que necesita.

En el detalle de una reserva pendiente o aceptada, antes del abordaje, se muestra
otro mapa. Se usa la ruta guardada en la reserva, con respaldo a la ruta actual
del taxista. Como destino inicial se prioriza el paradero de origen si pertenece
a la configuración; en otro caso, el paradero configurado más cercano al punto
de abordaje. Si no hay un punto conocido, se usa el primero en orden. El conductor
puede cambiar el destino entre los paraderos de esa misma ruta.

## Ubicación del cliente

El cliente activa «Compartir con mi taxista» desde una reserva aceptada. Requiere
permiso de ubicación y GPS. Se envía la posición a la RPC cada 10 segundos
mientras la pantalla está abierta y en primer plano. «Dejar de compartir»,
salir de la pantalla o pasar a segundo plano solicita borrar la ubicación.
Si esa solicitud no llega, la posición caduca a los 45 segundos. Volver a la
pantalla desde segundo plano reanuda el envío si el interruptor seguía activo;
volver a abrirla tras salir requiere activarlo otra vez.

El mapa del taxista consulta la RPC cada 5 segundos; esa es la frecuencia de
lectura, no una garantía de GPS instantáneo. Un fallo de conexión oculta el
mapa anterior para no presentar una posición privada antigua como actual.
Las consultas se pausan cuando la pantalla no está enfocada o la app está en
segundo plano. La leyenda dice «Cliente», para distinguirlo del taxi y del
punto fijo de abordaje.

Solo el propietario de una reserva aceptada y sin abordaje puede enviar su
ubicación. Solo el conductor asignado puede consultarla; el acceso a reservas
ajenas se rechaza. Al abordar, cancelar, cerrar o cambiar de conductor, un
trigger elimina la posición guardada. Las tablas tienen RLS y no permiten
lecturas ni escrituras directas a `anon` o `authenticated`. Las RPC validan
`auth.uid()` y usan `search_path = ''`. No se comparte mediante el enlace público
para familiares y no hay acceso anónimo a la ubicación de la reserva.

## Despliegue y validación

```sh
supabase db push --linked
supabase functions deploy distancias-paraderos
npm run typecheck
npm test
supabase db query --linked --file scripts/test-mapa-taxista.sql
```

La prueba SQL crea cuentas y reservas sintéticas dentro de una transacción y
finaliza con `ROLLBACK`. Comprueba permisos, selección de paraderos, acceso de
otro cliente/conductor, caducidad, revocación, abordaje y cancelación.

En dos dispositivos, iniciar servicio del taxista y configurar sus paraderos;
aceptar una reserva, activar el envío del cliente y verificar el pin «Cliente».
Mover ambos teléfonos, cambiar de paradero y comprobar el trazo y las cifras.
Desactivar el envío, bloquear el teléfono del cliente, desconectar internet y
confirmar el abordaje para comprobar que se oculte su posición. Verificar que
otro conductor no pueda acceder a esa reserva.
