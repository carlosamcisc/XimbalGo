import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import type { Coordenadas } from "../../modules/cliente/ubicacion";
import { conTiempoLimite } from "../../modules/cliente/tiempoLimite";

const MENSAJE_PERMISO_CERCANOS =
  "Se necesita permiso de ubicación para buscar opciones cercanas.";

async function asegurarUbicacionDisponible(mensajePermiso: string, pedirPermiso = true) {
  let permiso = await Location.getForegroundPermissionsAsync();
  if (!permiso.granted && pedirPermiso) {
    permiso = await Location.requestForegroundPermissionsAsync();
  }
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
 * El tiempo límite es opcional y solo se aplica si la pantalla lo solicita.
 */
export async function obtenerUbicacionActual(
  mensajePermiso = MENSAJE_PERMISO_CERCANOS,
  pedirPermiso = true,
  { tiempoEsperaMs }: { tiempoEsperaMs?: number } = {},
): Promise<Coordenadas> {
  await asegurarUbicacionDisponible(mensajePermiso, pedirPermiso);

  const posicion = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const ubicacion = tiempoEsperaMs === undefined
    ? await posicion
    : await conTiempoLimite(
      posicion,
      tiempoEsperaMs,
      "Está tardando en obtenerse tu ubicación. Verifica que el GPS esté activo y reintenta.",
    );

  return aCoordenadas(ubicacion);
}

/**
 * Avisa cada vez que el dispositivo se mueve. Solo funciona con la app en
 * primer plano. Devuelve la función para dejar de observar.
 */
export async function observarUbicacion(
  onCambio: (coordenadas: Coordenadas) => void,
  mensajePermiso = MENSAJE_PERMISO_CERCANOS,
  // Avisa al moverse `distanciaMetros`, a lo más cada `intervaloMs` (este
  // límite solo aplica en Android).
  { distanciaMetros = 50, intervaloMs = 30_000 } = {}
): Promise<() => void> {
  await asegurarUbicacionDisponible(mensajePermiso);

  const suscripcion = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: distanciaMetros,
      timeInterval: intervaloMs,
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

/**
 * Abre el punto en la app de mapas del dispositivo. Si no hay una app que
 * acepte el enlace nativo, lo abre en OpenStreetMap desde el navegador.
 */
export async function abrirEnMapa(
  { latitud, longitud }: Coordenadas,
  etiqueta: string
): Promise<void> {
  const punto = `${latitud},${longitud}`;
  const nombre = encodeURIComponent(etiqueta);
  const enlaceNativo = Platform.select({
    android: `geo:${punto}?q=${punto}(${nombre})`,
    ios: `maps:?q=${nombre}&ll=${punto}`,
  });

  if (enlaceNativo) {
    try {
      await Linking.openURL(enlaceNativo);
      return;
    } catch {
      // Sin app de mapas: se intenta con el navegador.
    }
  }

  await Linking.openURL(
    `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=16/${latitud}/${longitud}`
  );
}
