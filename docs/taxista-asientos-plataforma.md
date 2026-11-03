# US-0027: asientos en la plataforma

En **Vehículo → Asientos en la plataforma**, el taxista indica una cantidad
entre 0 y la capacidad física y pulsa **Guardar asientos en servicio**.
La cantidad incluye los asientos libres, reservados y ocupados que ofrece.
Los restantes aparecen como **Fuera de app** y no se pueden reservar.

La RPC `configurar_asientos_plataforma` verifica al propietario, bloquea los
asientos y cambia la oferta en una sola transacción. Solo retira asientos
libres, empezando por los últimos; al aumentar, habilita los primeros excluidos.
Las reservas y ocupaciones existentes se conservan. Los cambios se recargan
con las suscripciones de Realtime existentes.

`asientos.en_plataforma` conserva la selección. Para mantener compatibilidad
con las consultas de disponibilidad existentes, los excluidos usan estado
`ocupado` sin reserva; una restricción impide liberarlos por otras operaciones.
La interfaz del taxista los distingue de los pasajeros a bordo.
Al registrar un vehículo o aumentar su capacidad, los nuevos asientos se
ofrecen por defecto. La cantidad puede ajustarse después del registro.

Migración: `20261102130000_asientos_plataforma.sql`.
Prueba SQL con rollback: `supabase/tests/asientos_plataforma.sql` (requiere
un vehículo con al menos un asiento libre).
