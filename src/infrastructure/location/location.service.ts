import * as Location from "expo-location";
import type { Coordenadas } from "../../modules/cliente/ubicacion";

const MENSAJE_PERMISO_CERCANOS =
  "Se necesita permiso de ubicación para buscar opciones cercanas.";

async function asegurarUbicacionDisponible(mensajePermiso: string, pedirPermiso = true) {
  const permiso = pedirPermiso
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (!permiso.granted) {
    throw new Error(mensajePermiso);
  }

  const serviciosActivos = await Location.hasServicesEnabledAsync();
  if (!serviciosActivos) {
    throw new Error("Activa el GPS del dispositivo para usar tu ubicación.");
  }
}

const aCoordenadas = (ubicacion: Location.LocationObject): Coordenadas => ({
  latitud: ubicacion.coords.latitude,
  longitud: ubicacion.coords.longitude,
});

/**
 * Con `pedirPermiso` en false no abre el diálogo de permiso: si no está
 * concedido, falla con `mensajePermiso`.
 */
export async function obtenerUbicacionActual(
  mensajePermiso = MENSAJE_PERMISO_CERCANOS,
  pedirPermiso = true
): Promise<Coordenadas> {
  await asegurarUbicacionDisponible(mensajePermiso, pedirPermiso);

  const ubicacion = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return aCoordenadas(ubicacion);
}

/**
 * Avisa cada vez que el dispositivo se mueve. Solo funciona con la app en
 * primer plano. Devuelve la función para dejar de observar.
 */
export async function observarUbicacion(
  onCambio: (coordenadas: Coordenadas) => void,
  mensajePermiso = MENSAJE_PERMISO_CERCANOS
): Promise<() => void> {
  await asegurarUbicacionDisponible(mensajePermiso);

  const suscripcion = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: 30_000,
    },
    (ubicacion) => onCambio(aCoordenadas(ubicacion))
  );

  return () => suscripcion.remove();
}

export async function obtenerDireccionActual(
  coordenadas: Coordenadas
): Promise<string | null> {
  const [direccion] = await Location.reverseGeocodeAsync({
    latitude: coordenadas.latitud,
    longitude: coordenadas.longitud,
  });

  if (!direccion) {
    return null;
  }

  const calle = [direccion.street, direccion.streetNumber]
    .filter(Boolean)
    .join(" ");
  const partes = [
    direccion.name,
    calle,
    direccion.district,
    direccion.city,
    direccion.subregion,
    direccion.region,
    direccion.country,
  ].filter((parte): parte is string => Boolean(parte?.trim()));

  return [...new Set(partes)].join(", ") || null;
}
