import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Camera, Map, Marker, GeoJSONSource, Layer, type CameraRef } from "@maplibre/maplibre-react-native";
import { aLngLat, encuadreMapa } from "../modules/cliente/mapa";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import type { Coordenadas } from "../modules/cliente/ubicacion";

export interface MarcadorMapa {
  coordenadas: Coordenadas;
  titulo: string;
}

// La leyenda solo muestra los marcadores que la pantalla pasa, aunque sean null.
interface Props {
  taxi?: MarcadorMapa | null;
  punto?: MarcadorMapa | null;
  paradero?: MarcadorMapa | null;
  /** El propio cliente. */
  cliente?: MarcadorMapa | null;
  ruta?: import("geojson").LineString | null;
  style?: StyleProp<ViewStyle>;
}

type TipoMarcador = "taxi" | "punto" | "paradero" | "cliente";

const LEYENDA: { tipo: TipoMarcador; etiqueta: string; color: string }[] = [
  { tipo: "taxi", etiqueta: "Taxi", color: Colors.primary },
  { tipo: "punto", etiqueta: "Abordaje", color: Colors.success },
  { tipo: "paradero", etiqueta: "Paradero", color: Colors.brandDeep },
  { tipo: "cliente", etiqueta: "Tú", color: Colors.secondary },
];

const ESTILO_MAPA = "https://tiles.openfreemap.org/styles/liberty";
const VISTA_INICIAL = { center: [-89.62, 20.97] as [number, number], zoom: 11 };
const MARGEN_ENCUADRE = { top: 64, right: 48, bottom: 48, left: 48 };

function Marcador({ tipo, dato }: { tipo: TipoMarcador; dato: MarcadorMapa }) {
  return (
    <Marker
      id={tipo}
      lngLat={aLngLat(dato.coordenadas)}
      anchor="center"
      accessibilityLabel={dato.titulo}
    >
      <View collapsable={false} style={[styles.marcador, styles[tipo]]}>
        {tipo === "taxi" && <Icono nombre="localTaxi" tamanio={18} color={Colors.white} />}
      </View>
    </Marker>
  );
}

/** Mapa con el taxi, el punto de abordaje, el paradero y el cliente. */
export default function MapaSeguimiento(props: Props) {
  const { taxi, punto, paradero, cliente, style, ruta } = props;
  const camara = useRef<CameraRef>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [tamanoListo, setTamanoListo] = useState(false);
  const [errorMapa, setErrorMapa] = useState(false);
  const [intento, setIntento] = useState(0);
  const centrado = useRef(false);

  const encuadre = useMemo(
    () => encuadreMapa(
      [paradero, punto, cliente, taxi]
        .filter((dato): dato is MarcadorMapa => Boolean(dato))
        .map((dato) => dato.coordenadas)
        .concat((ruta?.coordinates ?? []).map(([longitud, latitud]) => ({ latitud, longitud })))
    ),
    [paradero, punto, cliente, taxi, ruta]
  );

  useEffect(() => { centrado.current = false; }, [ruta]);

  const centrar = useCallback(() => {
    if (!mapaListo || !tamanoListo || !encuadre || !camara.current) return;
    if ("center" in encuadre) {
      camara.current.easeTo({ ...encuadre, duration: 400 });
    } else {
      camara.current.fitBounds(encuadre.bounds, { padding: MARGEN_ENCUADRE, duration: 400 });
    }
  }, [mapaListo, tamanoListo, encuadre]);

  // Solo se encuadra la primera vez: después el cliente mueve el mapa.
  useEffect(() => {
    if (mapaListo && tamanoListo && !centrado.current && encuadre && camara.current) {
      centrar();
      centrado.current = true;
    }
  }, [mapaListo, tamanoListo, encuadre, centrar]);

  const reintentar = () => {
    centrado.current = false;
    setMapaListo(false);
    setErrorMapa(false);
    setIntento((actual) => actual + 1);
  };

  return (
    <View style={[styles.contenedor, style]}>
      <Map
        key={intento}
        mapStyle={ESTILO_MAPA}
        style={styles.mapa}
        onLayout={({ nativeEvent: { layout } }) => setTamanoListo(layout.width > 0 && layout.height > 0)}
        onDidFinishLoadingStyle={() => { setMapaListo(true); setErrorMapa(false); }}
        onDidFailLoadingMap={() => setErrorMapa(true)}
        touchRotate={false}
        touchPitch={false}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        androidView="texture"
      >
        <Camera ref={camara} initialViewState={VISTA_INICIAL} maxZoom={18} />
        {ruta && <GeoJSONSource id="ruta-paradero" data={ruta}>
          <Layer id="ruta-borde" type="line" paint={{ "line-color": Colors.white, "line-width": 9 }} layout={{ "line-cap": "round", "line-join": "round" }} />
          <Layer id="ruta-linea" type="line" paint={{ "line-color": Colors.primary, "line-width": 5 }} layout={{ "line-cap": "round", "line-join": "round" }} />
        </GeoJSONSource>}
        {paradero && <Marcador tipo="paradero" dato={paradero} />}
        {punto && <Marcador tipo="punto" dato={punto} />}
        {cliente && <Marcador tipo="cliente" dato={cliente} />}
        {taxi && <Marcador tipo="taxi" dato={taxi} />}
      </Map>
      {errorMapa && (
        <Pressable onPress={reintentar} accessibilityRole="button" style={styles.errorMapa}>
          <AppText style={styles.textoError}>No se pudo cargar el mapa. Toca para reintentar.</AppText>
        </Pressable>
      )}
      <Pressable
        onPress={centrar}
        accessibilityRole="button"
        accessibilityLabel="Centrar el mapa"
        style={({ pressed }) => [styles.centrar, pressed && styles.centrarPresionado]}
      >
        <Icono nombre="myLocation" tamanio={22} color={Colors.primary} />
      </Pressable>
      <View style={styles.leyenda} pointerEvents="none">
        {LEYENDA.filter(({ tipo }) => props[tipo] !== undefined).map(({ tipo, etiqueta, color }) => (
          <View key={tipo} style={styles.itemLeyenda}>
            <View style={[styles.puntoLeyenda, { backgroundColor: color }]} />
            <AppText style={styles.textoLeyenda}>{etiqueta}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    height: 280,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: Colors.surfaceContainer,
  },
  mapa: {
    flex: 1,
  },
  errorMapa: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "45%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  textoError: { fontSize: 13, textAlign: "center", color: Colors.brandText },
  marcador: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.white,
  },
  taxi: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
  },
  punto: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
  },
  paradero: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.brandDeep,
  },
  cliente: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.secondary,
  },
  centrar: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
    elevation: 3,
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  centrarPresionado: {
    backgroundColor: Colors.primaryContainer,
  },
  leyenda: {
    position: "absolute",
    left: 10,
    top: 10,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  itemLeyenda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  puntoLeyenda: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textoLeyenda: {
    fontSize: 11,
    color: Colors.brandText,
  },
});
