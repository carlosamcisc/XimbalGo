import * as Location from "expo-location";
import type { Coordenadas } from "../../modules/cliente/ubicacion";

export async function obtenerUbicacionActual(): Promise<Coordenadas> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) {
    throw new Error("Se necesita permiso de ubicación para buscar opciones cercanas.");
  }

  const serviciosActivos = await Location.hasServicesEnabledAsync();
  if (!serviciosActivos) {
    throw new Error("Activa el GPS del dispositivo para usar tu ubicación.");
  }

  const ubicacion = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitud: ubicacion.coords.latitude,
    longitud: ubicacion.coords.longitude,
  };
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
