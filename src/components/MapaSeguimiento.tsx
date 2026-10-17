import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
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

// Leaflet con teselas de OpenStreetMap servidas por CARTO: no necesita API key
// (Google Maps en Android sí). Sin internet, el script no carga y se avisa.
const HTML_MAPA = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #mapa { height: 100%; margin: 0; background: #ECEEF4; }
  .marcador { display: flex; align-items: center; justify-content: center;
    border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,.35);
    font-size: 16px; }
  .taxi { background: ${Colors.primary}; width: 34px; height: 34px; }
  .punto { background: ${Colors.success}; width: 22px; height: 22px; }
  .paradero { background: ${Colors.brandDeep}; width: 18px; height: 18px; }
</style>
</head>
<body>
<div id="mapa"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  onerror="window.ReactNativeWebView.postMessage('sin-mapa')"></script>
<script>
  (function () {
    if (!window.L) { return; }
    var mapa = L.map('mapa', { zoomControl: false, attributionControl: true })
      .setView([20.97, -89.62], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(mapa);

    var marcadores = {};
    var centrado = false;
    var icono = function (clase, texto) {
      var tamanio = clase === 'taxi' ? 34 : clase === 'punto' ? 22 : 18;
      return L.divIcon({
        className: '',
        html: '<div class="marcador ' + clase + '">' + (texto || '') + '</div>',
        iconSize: [tamanio, tamanio],
        iconAnchor: [tamanio / 2, tamanio / 2]
      });
    };

    var colocar = function (clave, dato, texto) {
      if (!dato) {
        if (marcadores[clave]) { mapa.removeLayer(marcadores[clave]); delete marcadores[clave]; }
        return;
      }
      var posicion = [dato.coordenadas.latitud, dato.coordenadas.longitud];
      if (marcadores[clave]) {
        marcadores[clave].setLatLng(posicion);
        marcadores[clave].setTooltipContent(dato.titulo);
      } else {
        marcadores[clave] = L.marker(posicion, { icon: icono(clave, texto), zIndexOffset: clave === 'taxi' ? 1000 : 0 })
          .bindTooltip(dato.titulo, { direction: 'top', offset: [0, -14] })
          .addTo(mapa);
      }
    };

    window.centrarMapa = function () {
      var puntos = Object.keys(marcadores).map(function (clave) { return marcadores[clave].getLatLng(); });
      if (puntos.length === 1) { mapa.setView(puntos[0], 16); }
      if (puntos.length > 1) { mapa.fitBounds(L.latLngBounds(puntos), { padding: [48, 48], maxZoom: 17 }); }
    };

    window.actualizarMapa = function (datos) {
      colocar('paradero', datos.paradero, '');
      colocar('punto', datos.punto, '');
      colocar('taxi', datos.taxi, '&#128661;');
      // Solo se encuadra la primera vez: después el cliente mueve el mapa.
      if (!centrado && Object.keys(marcadores).length > 0) {
        centrado = true;
        window.centrarMapa();
      }
    };

    window.ReactNativeWebView.postMessage('listo');
  })();
</script>
</body>
</html>`;

/** Mapa con el taxi, el punto de abordaje y el paradero cercano. */
export default function MapaSeguimiento({ taxi, punto, paradero, style }: Props) {
  const webView = useRef<WebView>(null);
  const [listo, setListo] = useState(false);
  const [sinMapa, setSinMapa] = useState(false);

  // Se mueven los marcadores sin volver a cargar la página.
  useEffect(() => {
    if (!listo) {
      return;
    }
    const datos = JSON.stringify({ taxi, punto, paradero });
    webView.current?.injectJavaScript(`window.actualizarMapa(${datos}); true;`);
  }, [listo, taxi, punto, paradero]);

  const recibirMensaje = (evento: WebViewMessageEvent) => {
    if (evento.nativeEvent.data === "listo") {
      setListo(true);
    } else if (evento.nativeEvent.data === "sin-mapa") {
      setSinMapa(true);
    }
  };

  if (sinMapa) {
    return (
      <View style={[styles.contenedor, styles.sinMapa, style]}>
        <Icono nombre="map" tamanio={36} color={Colors.outlineVariant} />
        <AppText style={styles.textoSinMapa}>No se pudo cargar el mapa. Revisa tu conexión a internet.</AppText>
        <Pressable
          onPress={() => {
            setSinMapa(false);
            setListo(false);
          }}
          accessibilityRole="button"
        >
          <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.contenedor, style]}>
      <WebView
        ref={webView}
        originWhitelist={["*"]}
        // El origen da a las solicitudes de teselas un `Referer` válido.
        source={{ html: HTML_MAPA, baseUrl: "https://ximbalgo.app/" }}
        onMessage={recibirMensaje}
        onError={() => setSinMapa(true)}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        nestedScrollEnabled
        style={styles.webView}
      />
      <Pressable
        onPress={() => webView.current?.injectJavaScript("window.centrarMapa && window.centrarMapa(); true;")}
        accessibilityRole="button"
        accessibilityLabel="Centrar el mapa"
        style={({ pressed }) => [styles.centrar, pressed && styles.centrarPresionado]}
      >
        <Icono nombre="myLocation" tamanio={22} color={Colors.primary} />
      </Pressable>
      <View style={styles.leyenda} pointerEvents="none">
        <View style={styles.itemLeyenda}>
          <View style={[styles.puntoLeyenda, { backgroundColor: Colors.primary }]} />
          <AppText style={styles.textoLeyenda}>Taxi</AppText>
        </View>
        <View style={styles.itemLeyenda}>
          <View style={[styles.puntoLeyenda, { backgroundColor: Colors.success }]} />
          <AppText style={styles.textoLeyenda}>Abordaje</AppText>
        </View>
        <View style={styles.itemLeyenda}>
          <View style={[styles.puntoLeyenda, { backgroundColor: Colors.brandDeep }]} />
          <AppText style={styles.textoLeyenda}>Paradero</AppText>
        </View>
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
  webView: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
  },
  sinMapa: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },
  textoSinMapa: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
  },
  enlace: {
    fontSize: 14,
    color: Colors.primary,
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
