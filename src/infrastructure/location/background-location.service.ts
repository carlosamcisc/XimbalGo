import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, AppState, Platform } from "react-native";
import { supabase } from "../supabase/client";
import { actualizarUbicacion, obtenerPerfilTaxista } from "../supabase/repositories/taxista.repository";
import { actualizarUbicacionCompartida } from "../supabase/repositories/ubicacionCompartida.repository";

const TAREA = "ximbalgo-ubicacion-v1";
const CLAVE = "@ximbalgo/seguimiento-v1";
export type DestinoUbicacion = { usuarioId: string } & (
  | { tipo: "taxista" }
  | { tipo: "cliente"; compartidaId: string; expiraEn: string }
);

// Serializa altas y bajas: una limpieza anterior nunca detiene el alta siguiente.
let operaciones: Promise<unknown> = Promise.resolve();
function serializar<T>(operacion: () => Promise<T>): Promise<T> {
  const siguiente = operaciones.then(operacion, operacion);
  operaciones = siguiente.catch(() => undefined);
  return siguiente;
}

async function detener() {
  await AsyncStorage.removeItem(CLAVE);
  if (await Location.hasStartedLocationUpdatesAsync(TAREA)) {
    await Location.stopLocationUpdatesAsync(TAREA);
  }
}

export function detenerUbicacionSegundoPlano(destino?: DestinoUbicacion): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  return serializar(async () => {
    if (destino && await AsyncStorage.getItem(CLAVE) !== JSON.stringify(destino)) return;
    await detener();
  });
}

async function esperarPrimerPlano(): Promise<void> {
  if (AppState.currentState === "active") return;
  await new Promise<void>((resolve, reject) => {
    const suscripcion = AppState.addEventListener("change", estado => {
      if (estado !== "active") return;
      clearTimeout(limite);
      suscripcion.remove();
      resolve();
    });
    const limite = setTimeout(() => {
      suscripcion.remove();
      reject(new Error("Vuelve a Ximbal Go para iniciar la ubicación en segundo plano."));
    }, 10_000);
    if (AppState.currentState === "active") {
      clearTimeout(limite);
      suscripcion.remove();
      resolve();
    }
  });
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(TAREA)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREA, async ({ data, error }) => {
    if (error || !data?.locations.length) return;
    await serializar(async () => {
      const guardado = await AsyncStorage.getItem(CLAVE);
      if (!guardado) return;
      const destino: DestinoUbicacion = JSON.parse(guardado);
      const { data: sesion, error: errorSesion } = await supabase.auth.getSession();
      if (errorSesion) throw errorSesion;
      if (sesion.session?.user.id !== destino.usuarioId ||
          (destino.tipo === "cliente" && Date.parse(destino.expiraEn) <= Date.now())) {
        await detener();
        return;
      }
      // No depende de AppState: una ejecución sin UI puede no conocer su estado.
      const ultima = data.locations.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
      const coordenadas = { latitud: ultima.coords.latitude, longitud: ultima.coords.longitude };
      if (destino.tipo === "taxista") {
        if (!(await obtenerPerfilTaxista(destino.usuarioId)).enServicio) {
          await detener();
          return;
        }
        await actualizarUbicacion(coordenadas);
      } else if (!await actualizarUbicacionCompartida(destino.compartidaId, coordenadas)) {
        await detener();
      }
    });
  });
}

export async function asegurarPermisoSegundoPlano(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!await TaskManager.isAvailableAsync()) {
    throw new Error("La ubicación en segundo plano requiere una compilación nativa de Ximbal Go.");
  }
  const primerPlano = await Location.requestForegroundPermissionsAsync();
  if (!primerPlano.granted) throw new Error("Permite el acceso a tu ubicación para continuar.");
  if ((await Location.getBackgroundPermissionsAsync()).granted) return;
  const continuar = await new Promise<boolean>((resolve) => Alert.alert(
    "Ubicación en segundo plano",
    "Ximbal Go usará tu ubicación al bloquear el teléfono o abrir otra app mientras estés en servicio o compartiendo tu ubicación. En los ajustes elige permitir la ubicación todo el tiempo. Puedes detenerla al salir de servicio o dejar de compartir.",
    [{ text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Continuar", onPress: () => resolve(true) }],
    { cancelable: false }
  ));
  if (!continuar || !(await Location.requestBackgroundPermissionsAsync()).granted) {
    throw new Error("Se necesita permiso de ubicación todo el tiempo. Puedes habilitarlo en los ajustes del dispositivo.");
  }
}

export function iniciarUbicacionSegundoPlano(destino: DestinoUbicacion): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  return serializar(async () => {
    const configuracion = JSON.stringify(destino);
    if (await AsyncStorage.getItem(CLAVE) === configuracion &&
        await Location.hasStartedLocationUpdatesAsync(TAREA)) return;
    // Los permisos/ajustes y el menú de compartir pueden ocultar la actividad.
    await esperarPrimerPlano();
    // Al restaurar una sesión no abre diálogos de permiso automáticamente.
    if (!(await Location.getBackgroundPermissionsAsync()).granted) {
      throw new Error("Activa el permiso de ubicación todo el tiempo en los ajustes para continuar el seguimiento en segundo plano.");
    }
    await AsyncStorage.setItem(CLAVE, configuracion);
    try {
      await esperarPrimerPlano();
      await Location.startLocationUpdatesAsync(TAREA, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 30_000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Ximbal Go · ubicación activa",
          notificationBody: destino.tipo === "taxista"
            ? "Estás en servicio. Sal de servicio para detener la ubicación."
            : "Compartes tu ubicación. Detén el enlace desde la app para finalizar.",
          killServiceOnDestroy: true,
        },
      });
    } catch (e) {
      await detener();
      throw e;
    }
  });
}
