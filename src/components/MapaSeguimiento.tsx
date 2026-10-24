import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import type { Coordenadas } from "../modules/cliente/ubicacion";

export interface MarcadorMapa {
  coordenadas: Coordenadas;
  titulo: string;
}

interface Props {
  taxi: MarcadorMapa | null;
  punto: MarcadorMapa | null;
  paradero: MarcadorMapa | null;
  style?: StyleProp<ViewStyle>;
}

type TipoMarcador = "taxi" | "punto" | "paradero";
const COLORES: Record<TipoMarcador, string> = {
  taxi: "#0066FF",
  punto: "#16A34A",
  paradero: "#0F2D5B",
};

/** Mapa Leaflet en WebView: funciona en Expo Go sin SDK cartográfico nativo. */
export default function MapaSeguimiento({ taxi, punto, paradero, style }: Props) {
  const webView = useRef<WebView<{}>>(null);
  const [listo, setListo] = useState(false);
  const markers = useMemo(() => [
    ...([paradero, punto, taxi] as const).flatMap((dato, index) => dato ? [{
      lat: dato.coordenadas.latitud,
      lon: dato.coordenadas.longitud,
      title: dato.titulo.replace(/[&<>"']/g, ""),
      color: COLORES[(["paradero", "punto", "taxi"] as const)[index]],
      kind: (["paradero", "punto", "taxi"] as const)[index],
    }] : []),
  ], [taxi, punto, paradero]);
  const mapHtml = useMemo(() => {
    const data = JSON.stringify(markers);
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>*{box-sizing:border-box}html,body,#map{height:100%;margin:0} .dot{border:3px solid white;border-radius:50%;box-shadow:0 2px 5px #5558}.taxi{width:34px;height:34px}.punto{width:22px;height:22px}.paradero{width:18px;height:18px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const pts=${data};const map=L.map('map',{zoomControl:false}).setView([20.97,-89.62],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);const pins=pts.map(p=>L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:'<div class="dot '+p.kind+'" style="background:'+p.color+'"></div>',iconSize:[p.kind==='taxi'?34:p.kind==='punto'?22:18,p.kind==='taxi'?34:p.kind==='punto'?22:18],iconAnchor:[p.kind==='taxi'?17:p.kind==='punto'?11:9,p.kind==='taxi'?17:p.kind==='punto'?11:9]})}).bindPopup(p.title).addTo(map));if(pins.length===1)map.setView(pins[0].getLatLng(),16);else if(pins.length>1)map.fitBounds(L.featureGroup(pins).getBounds().pad(.25));window.centerMap=()=>{if(pins.length===1)map.setView(pins[0].getLatLng(),16);else if(pins.length>1)map.fitBounds(L.featureGroup(pins).getBounds().pad(.25))};</script></body></html>`;
  }, [markers]);
  const centrar = () => webView.current?.injectJavaScript("window.centerMap&&window.centerMap();true;");

  return (
    <View style={[styles.contenedor, style]}>
      <WebView ref={webView} source={{ html: mapHtml }} style={styles.mapa} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled onLoadEnd={() => setListo(true)} />
      {listo && <Pressable onPress={centrar} accessibilityRole="button" accessibilityLabel="Centrar el mapa" style={({ pressed }) => [styles.centrar, pressed && styles.centrarPresionado]}><Icono nombre="myLocation" tamanio={22} color={Colors.primary} /></Pressable>}
      <View style={styles.leyenda} pointerEvents="none">
        {([[Colors.primary, "Taxi"], [Colors.success, "Abordaje"], [Colors.brandDeep, "Paradero"]] as const).map(([color, label]) => <View key={label} style={styles.itemLeyenda}><View style={[styles.puntoLeyenda, { backgroundColor: color }]} /><AppText style={styles.textoLeyenda}>{label}</AppText></View>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { height: 280, borderRadius: 22, overflow: "hidden", backgroundColor: Colors.surfaceContainer },
  mapa: { flex: 1 },
  centrar: { position: "absolute", top: 10, right: 10, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: Colors.white, elevation: 3, shadowColor: Colors.black, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  centrarPresionado: { backgroundColor: Colors.primaryContainer },
  leyenda: { position: "absolute", left: 10, top: 10, flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.92)" },
  itemLeyenda: { flexDirection: "row", alignItems: "center", gap: 4 },
  puntoLeyenda: { width: 10, height: 10, borderRadius: 5 },
  textoLeyenda: { fontSize: 11, color: Colors.brandText },
});
