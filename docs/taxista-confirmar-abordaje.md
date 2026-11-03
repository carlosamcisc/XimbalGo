# US-0026: confirmar que el cliente subió al taxi

En **Viajes**, el taxista abre el detalle de una reserva aceptada y toca **Cliente a bordo**. La app guarda la confirmación en Supabase y muestra la fecha y hora en el detalle y en las tarjetas del taxista y del cliente. El botón desaparece después de confirmar y el viaje sigue activo hasta completarse.

El cliente recibe **¡Ya estás a bordo!** en sus notificaciones. El aviso queda guardado aunque tenga la app cerrada; con la app abierta llega mediante Supabase Realtime y, al volver del segundo plano, se recargan las notificaciones y reservaciones. Tocar el aviso abre el viaje correspondiente. Se usa el sistema existente de notificaciones dentro de la app; no se envía push al sistema operativo.

Después del abordaje se ocultan las estimaciones para recoger al cliente, la cancelación por parte del cliente y la acción **No se presentó**. La base también rechaza estas dos últimas operaciones si llegan desde una versión anterior de la app. El taxista conserva las acciones existentes para completar o cancelar el viaje.

## Supabase

La migración [20261102120000_confirmar_abordaje.sql](../supabase/migrations/20261102120000_confirmar_abordaje.sql) agrega:

- `reservas.abordado_en`: fecha del servidor, conservada en el historial.
- `confirmar_abordaje_taxista(p_reserva_id)`: RPC disponible para usuarios autenticados. Valida que la reserva sea del taxista de la sesión y esté aceptada. Bloquea la fila para evitar confirmaciones simultáneas y devuelve la misma fecha al reintentar.
- Notificación `cliente_abordo` para el cliente de la reserva, creada en la misma transacción. Si falla el aviso, tampoco se guarda el abordaje.
- Fecha de abordaje en `obtener_reservas_taxista()` y protección de los estados incompatibles con el abordaje.

Se mantienen los permisos existentes: el cliente y el taxista no pueden escribir directamente en reservas ni crear notificaciones. No se agregan dependencias móviles.

## Validación

`npm run typecheck` valida la integración TypeScript. La prueba [confirmar_abordaje.sql](../supabase/tests/confirmar_abordaje.sql) valida autorización, reserva pendiente y cerrada, fecha persistente, aviso único sin leer, reintentos, lectura del cliente con RLS, aislamiento del aviso y cierre del viaje. Se ejecuta con:

```sh
npx supabase db query --linked --file supabase/tests/confirmar_abordaje.sql
```

La prueba requiere al menos una reserva existente como fuente de relaciones para una reserva temporal. Todo se ejecuta dentro de una transacción con `rollback`, sin conservar datos de prueba.

Para validar visualmente, abrir una reserva aceptada con las dos cuentas: confirmar desde el taxista, comprobar el aviso y la hora en el cliente, volver a abrir las apps y completar el viaje. La fecha debe conservarse en el historial.
