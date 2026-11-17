import type { Coordenadas } from "./ubicacion";

type LngLat = [number, number];
type EncuadreMapa = { center: LngLat; zoom: number } | { bounds: [number, number, number, number] };

// GeoJSON y MapLibre usan longitud primero; el GPS del dominio usa nombres.
export const aLngLat = ({ latitud, longitud }: Coordenadas): LngLat => [longitud, latitud];

export function encuadreMapa(puntos: Coordenadas[]): EncuadreMapa | null {
  if (!puntos.length) return null;
  const longitudes = puntos.map((p) => p.longitud);
  const latitudes = puntos.map((p) => p.latitud);
  const oeste = Math.min(...longitudes);
  const este = Math.max(...longitudes);
  const sur = Math.min(...latitudes);
  const norte = Math.max(...latitudes);
  // Evita un encuadre de área cero cuando varios marcadores coinciden.
  if (este - oeste < 0.000001 && norte - sur < 0.000001) {
    return { center: aLngLat(puntos[0]), zoom: 16 };
  }
  return { bounds: [oeste, sur, este, norte] };
}
