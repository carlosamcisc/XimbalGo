# Trazo del taxi en la reservación

El pin «Tú» muestra la ubicación actual del teléfono del cliente, con un icono
de persona y su propio color, tanto en el mapa pequeño como en el ampliado.
Se obtiene con permiso de ubicación en primer plano y se observa con umbrales
de 10 metros y 5 segundos en Android. Se detiene al salir de la pantalla o
pasar a segundo plano. Al regresar se obtiene una posición nueva. Si falta
permiso o GPS, se informa sin impedir el seguimiento del taxi.
Esta posición no cambia el abordaje, el paradero ni los cálculos de ruta.
Solo se envía a Supabase si el cliente activa «Compartir con mi taxista» en una
reserva aceptada. Ver [Mapa del taxista](mapa-taxista.md) para el alcance y la caducidad.

`ClienteReservaScreen` muestra el trayecto sugerido en auto desde la ubicación
del taxi hasta el paradero cercano. Si no hay paradero disponible, utiliza el
punto de abordaje. El trazo, la distancia y el tiempo siempre usan el mismo destino.
No es un historial ni garantiza el camino
elegido por el conductor. La distancia y duración vienen del mismo recorrido de
GraphHopper. La hora de llegada suma la duración a la hora de inicio del cálculo.
No se descuenta tiempo por el simple paso del reloj: se espera una nueva consulta
para no simular avance cuando el taxi esté detenido. No se afirma que incluya tráfico.

El marcador conserva su actualización por Supabase Realtime. `useRutaTaxi`
consulta el trazo al abrir la pantalla y revisa la última posición cada 30 segundos;
recalcula si hubo un desplazamiento de al menos 50 metros o pasaron 60 segundos
desde el último cálculo, incluso si el taxi sigue detenido. Los errores se reintentan
en el siguiente intervalo y se avisa cuando se conservan un trazo y estimación anteriores.
Las consultas se detienen al salir de la pantalla, pasar la app a segundo plano,
confirmar el abordaje o dejar de estar activa la reserva.

## Servicio

Se debe desplegar la versión actualizada de la Edge Function existente:

```sh
supabase functions deploy distancias-paraderos
```

Utiliza los secretos GraphHopper existentes. Opcionalmente,
`GRAPHHOPPER_PERFIL_AUTO` permite configurar el perfil del taxi (por defecto `car`).
La solicitud `{ reservaId, destino: "paradero" }` (o `"abordaje"` cuando no hay paradero) consulta `obtener_seguimiento_reserva` con el token
del cliente para verificar la propiedad de la reserva y obtener origen y destino.
No acepta coordenadas suministradas por el cliente para este trayecto.
No se requieren migraciones nuevas.

## Validación

`npm run typecheck` y `npm test` verifican los tipos y las pruebas automatizadas.
En un dispositivo, abrir una reserva activa con taxi en servicio, mover el taxi
más de 50 metros y comprobar que cambien el marcador y el trazo. Probar también
un error de conexión, la vuelta desde segundo plano y la confirmación del abordaje.
