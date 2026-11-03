# Ubicación en segundo plano

Taxistas en servicio y clientes con un enlace de ubicación vigente utilizan una tarea nativa de Expo Location / TaskManager. El permiso adicional se pide al activar esas funciones, con una explicación previa. Si se deniega no se activa la función; al restaurar una sesión sin ese permiso se conserva el observador de primer plano y se muestra un error.

Android muestra una notificación persistente. iOS muestra el indicador de ubicación. La tarea guarda el destino y el usuario en AsyncStorage, utiliza la sesión persistida de Supabase y comprueba que corresponda al mismo usuario antes de enviar. No guarda credenciales adicionales. Se detiene al salir de servicio, dejar de compartir, desmontar el contexto o cerrar sesión. En cada evento también verifica la caducidad del enlace o que el taxista siga en servicio. No almacena recorridos ni implementa una cola sin conexión.

Antes de abrir el menú de compartir se espera la confirmación del servicio nativo. Si falla, se termina el enlace recién creado y se informa del error sin abrir ese menú. El inicio espera hasta diez segundos a que la app vuelva al primer plano tras los permisos o ajustes; al volver a estar activa, los contextos reintentan sin pedir permisos. Un servicio ya iniciado para el mismo destino se reutiliza y la limpieza de un enlace anterior no detiene el nuevo.

Se solicita precisión balanceada, sin distancia mínima y con intervalo de 30 segundos en Android, para recibir posiciones también estando quieto. La frecuencia real depende del sistema; iOS no garantiza ese intervalo. Los temporizadores de primer plano solicitan una posición nueva. El observador de UI y la tarea nativa pueden enviar posiciones próximas mientras la app está abierta.

## Compilación y pruebas en dispositivo

Esta función requiere reconstruir la aplicación nativa; actualizar Metro no incorpora permisos ni módulos. Los directorios android/ e ios/ se generan y no están versionados. Ejecutar `npx expo prebuild --platform android` y `npx expo run:android` para sincronizar el proyecto Android existente. Para iOS, generar y compilar en macOS o mediante EAS con el identificador de aplicación configurado. Expo Go y la versión web no ofrecen este seguimiento; web mantiene el funcionamiento de primer plano.

Pruebas automáticas: `npm run typecheck` y `node --test scripts/test-background-location.cjs`.

Validación manual pendiente en Android e iOS:

1. Entrar en servicio, aceptar los permisos, bloquear el teléfono y desplazarse; comprobar coordenadas y fecha en otro dispositivo durante varios minutos.
2. Repetir con una ubicación de cliente compartida, abriendo otra app y permaneciendo quieto.
3. Denegar/cancelar permisos y comprobar el mensaje; habilitarlos desde ajustes y volver a activar la función.
4. Salir de servicio, dejar de compartir y cerrar sesión; comprobar que cesan las actualizaciones y desaparece la notificación.
5. Dejar vencer el enlace con la app bloqueada: no debe aceptar nuevas posiciones; la tarea se da de baja en el siguiente evento nativo.
6. Cerrar forzosamente y reabrir: el sistema no garantiza seguimiento tras forzar el cierre; al abrir se restaura según el estado vigente.

Referencias: https://docs.expo.dev/versions/v57.0.0/sdk/location/ y https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/.
