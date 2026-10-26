import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";
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
  style?: StyleProp<ViewStyle>;
}

type TipoMarcador = "taxi" | "punto" | "paradero" | "cliente";

const LEYENDA: { tipo: TipoMarcador; etiqueta: string; color: string }[] = [
  { tipo: "taxi", etiqueta: "Taxi", color: Colors.primary },
  { tipo: "punto", etiqueta: "Abordaje", color: Colors.success },
  { tipo: "paradero", etiqueta: "Paradero", color: Colors.brandDeep },
  { tipo: "cliente", etiqueta: "Tú", color: Colors.secondary },
];

// Mérida, mientras no hay marcadores.
const REGION_INICIAL = {
  latitude: 20.97,
  longitude: -89.62,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};
const ZOOM_UN_PUNTO = 16;
const MARGEN_ENCUADRE = { top: 64, right: 48, bottom: 48, left: 48 };

const aLatLng = ({ latitud, longitud }: Coordenadas): LatLng => ({
  latitude: latitud,
  longitude: longitud,
});

/** Círculo de color con borde blanco, igual que en la leyenda. */
function Marcador({ tipo, dato }: { tipo: TipoMarcador; dato: MarcadorMapa }) {
  // Android dibuja la vista del marcador como imagen: se deja de redibujar
  // cuando ya se pintó, para que mover el taxi no cueste.
  const [redibujar, setRedibujar] = useState(true);
  useEffect(() => {
    const temporizador = setTimeout(() => setRedibujar(false), 500);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <Marker
      coordinate={aLatLng(dato.coordenadas)}
      title={dato.titulo}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={tipo === "taxi" ? 1000 : 0}
      tracksViewChanges={redibujar}
    >
      <View style={[styles.marcador, styles[tipo]]}>
        {tipo === "taxi" && <Icono nombre="localTaxi" tamanio={18} color={Colors.white} />}
      </View>
    </Marker>
  );
}

/** Mapa de Google con el taxi, el punto de abordaje, el paradero y el cliente. */
export default function MapaSeguimiento(props: Props) {
  const { taxi, punto, paradero, cliente, style } = props;
  const mapa = useRef<MapView>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const centrado = useRef(false);

  const puntos = [paradero, punto, cliente, taxi]
    .filter((dato): dato is MarcadorMapa => Boolean(dato))
    .map((dato) => aLatLng(dato.coordenadas));

  const centrar = () => {
    if (puntos.length === 1) {
      mapa.current?.animateCamera({ center: puntos[0], zoom: ZOOM_UN_PUNTO });
    } else if (puntos.length > 1) {
      mapa.current?.fitToCoordinates(puntos, { edgePadding: MARGEN_ENCUADRE, animated: true });
    }
  };

  // Solo se encuadra la primera vez: después el cliente mueve el mapa.
  useEffect(() => {
    if (mapaListo && !centrado.current && puntos.length > 0) {
      centrado.current = true;
      centrar();
    }
  });

  return (
    <View style={[styles.contenedor, style]}>
      <MapView
        ref={mapa}
        provider={PROVIDER_GOOGLE}
        style={styles.mapa}
        initialRegion={REGION_INICIAL}
        onMapReady={() => setMapaListo(true)}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {paradero && <Marcador tipo="paradero" dato={paradero} />}
        {punto && <Marcador tipo="punto" dato={punto} />}
        {cliente && <Marcador tipo="cliente" dato={cliente} />}
        {taxi && <Marcador tipo="taxi" dato={taxi} />}
      </MapView>
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
