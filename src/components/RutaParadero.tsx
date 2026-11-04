import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LineString } from "geojson";
import { supabase } from "../infrastructure/supabase/client";
import { obtenerUbicacionActual, observarUbicacion } from "../infrastructure/location/location.service";
import type { Coordenadas } from "../modules/cliente/ubicacion";
import Colors from "../theme/colors";
import AppText from "./AppText";
import MapaSeguimiento from "./MapaSeguimiento";
import Chip from "./Chip";
import { Icono } from "./Icono";
import { conTiempoLimite } from "../modules/cliente/tiempoLimite";

type ModoRuta = "caminando" | "moto";

interface Trayecto {
  metros: number;
  segundos: number;
  geometria: LineString;
  modo: ModoRuta;
  aproximada: boolean;
}

interface Props {
  id: string;
  nombre: string;
  destino: Coordenadas;
  onAbrirMapaExterno: () => void;
}

export default function RutaParadero({ id, nombre, destino, onAbrirMapaExterno }: Props) {
  const [origen, setOrigen] = useState<Coordenadas | null>(null);
  const [ruta, setRuta] = useState<Trayecto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fase, setFase] = useState("Obteniendo tu ubicación…");
  const [error, setError] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState(false);
  const solicitud = useRef(0);
  const peticion = useRef<AbortController | null>(null);
  const [automatico, setAutomatico] = useState(false);
  const [modo, setModo] = useState<ModoRuta>("caminando");
  const [intento, setIntento] = useState(0);
  const enfocado = useIsFocused();
  const [activa, setActiva] = useState(AppState.currentState === "active");

  const calcular = useCallback(async (ubicacion: Coordenadas) => {
    const actual = ++solicitud.current;
    setCargando(true);
    setFase(`Calculando la ruta ${modo === "moto" ? "en moto" : "caminando"}…`);
    setError(null);
    const controlador = new AbortController();
    peticion.current?.abort();
    peticion.current = controlador;
    try {
      setOrigen(ubicacion);
      const { data, error: fallo } = await conTiempoLimite(
        supabase.functions.invoke("distancias-paraderos", {
          body: { ...ubicacion, paraderoId: id, modo },
          signal: controlador.signal,
        }),
        15_000,
        "El servicio de rutas tardó demasiado. Revisa tu conexión a internet y reintenta.",
        () => controlador.abort(),
      );
      if (fallo || data?.error) throw new Error(`No se pudo calcular la ruta ${modo === "moto" ? "en moto" : "caminando"}. Intenta de nuevo.`);
      if (data?.modo !== modo) throw new Error("El servicio no devolvió el modo de viaje solicitado. Intenta de nuevo.");
      if (!Number.isFinite(data?.metros) || data.metros < 0 || !Number.isFinite(data?.segundos) || data.segundos < 0 || data?.geometria?.type !== "LineString" || !Array.isArray(data.geometria.coordinates) || data.geometria.coordinates.length < 2 || !data.geometria.coordinates.every((p: unknown) => Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 && typeof p[1] === "number" && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)) {
        throw new Error("El servicio no devolvió una ruta válida. Intenta de nuevo.");
      }
      if (actual === solicitud.current) setRuta(data as Trayecto);
    } catch (causa) {
      if (actual === solicitud.current) setError(causa instanceof Error ? causa.message : "No se pudo obtener la ruta.");
    } finally {
      if (peticion.current === controlador) peticion.current = null;
      if (actual === solicitud.current) setCargando(false);
    }
  }, [id, modo]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (estado) => setActiva(estado === "active"));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!automatico || !enfocado || !activa) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    let detener: (() => void) | undefined;
    let ocupado = false;
    let ultimaConsulta = 0;
    let ultimoOrigen: Coordenadas | null = null;
    let pendiente: Coordenadas | null = null;

    const actualizar = async () => {
      if (cancelado || ocupado || !pendiente || Date.now() - ultimaConsulta < 30_000) return;
      const ubicacion = pendiente;
      // Distancia aproximada en metros, suficiente para filtrar fluctuaciones del GPS.
      if (ultimoOrigen) {
        const norte = (ubicacion.latitud - ultimoOrigen.latitud) * 111_320;
        const este = (ubicacion.longitud - ultimoOrigen.longitud) * 111_320 * Math.cos(ubicacion.latitud * Math.PI / 180);
        if (Math.hypot(norte, este) < 50) return;
      }
      pendiente = null;
      ultimoOrigen = ubicacion;
      ultimaConsulta = Date.now();
      ocupado = true;
      try { await calcular(ubicacion); } finally { ocupado = false; }
    };

    const iniciar = async () => {
      setCargando(true);
      setFase("Obteniendo tu ubicación…");
      setError(null);
      try {
        const ubicacion = await obtenerUbicacionActual(
          "Permite el acceso a tu ubicación para ver cómo llegar al paradero.",
          true,
          { tiempoEsperaMs: 15_000 },
        );
        if (cancelado) return;
        pendiente = ubicacion;
        await actualizar();
        if (cancelado) return;
        const quitar = await observarUbicacion((posicion) => {
          if (cancelado) return;
          setOrigen(posicion);
          pendiente = posicion;
          void actualizar();
        }, "Permite el acceso a tu ubicación para actualizar la ruta.", { distanciaMetros: 10, intervaloMs: 5_000 });
        if (cancelado) quitar();
        else detener = quitar;
      } catch (causa) {
        if (!cancelado) {
          setCargando(false);
          setError(causa instanceof Error ? causa.message : "No se pudo iniciar la actualización automática.");
        }
      }
    };

    // Procesa también el último movimiento recibido durante el límite de consultas.
    const intervalo = setInterval(() => { void actualizar(); }, 1_000);
    void iniciar();
    return () => {
      cancelado = true;
      solicitud.current += 1;
      peticion.current?.abort();
      clearInterval(intervalo);
      detener?.();
    };
  }, [automatico, enfocado, activa, calcular, intento]);

  const mapa = (completo: boolean) => <MapaSeguimiento
    paradero={{ coordenadas: destino, titulo: nombre }}
    cliente={origen ? { coordenadas: origen, titulo: "Tu ubicación actual" } : null}
    ruta={ruta?.geometria}
    style={completo ? styles.completo : undefined}
  />;

  const distancia = ruta
    ? ruta.metros < 1000 ? `${Math.round(ruta.metros)} m` : `${(ruta.metros / 1000).toFixed(1)} km`
    : "";
  const duracion = ruta ? `${Math.max(1, Math.ceil(ruta.segundos / 60))} min` : "";
  const seguimientoActivo = automatico && enfocado && activa;

  const estado = <View style={styles.estado}>
    {ruta ? <>
      <View style={styles.metricas}>
        <View style={styles.metrica} accessible accessibilityLabel={`Distancia: ${distancia}`}>
          <View style={styles.etiquetaMetrica}>
            <Icono nombre="route" tamanio={18} color={Colors.primary} />
            <AppText style={styles.etiquetaResumen}>Distancia</AppText>
          </View>
          <AppText weight="bold" style={styles.valorMetrica}>{distancia}</AppText>
        </View>
        <View style={styles.metrica} accessible accessibilityLabel={`Tiempo estimado ${ruta.modo === "moto" ? "en moto" : "a pie"}: ${duracion}`}>
          <View style={styles.etiquetaMetrica}>
            <Icono nombre={ruta.modo === "moto" ? "twoWheeler" : "directionsWalk"} tamanio={18} color={Colors.primary} />
            <AppText style={styles.etiquetaResumen}>{ruta.modo === "moto" ? "En moto" : "A pie"}</AppText>
          </View>
          <View style={styles.tiempoResumen}>
            <AppText weight="bold" style={styles.valorMetrica}>{duracion}</AppText>
            <AppText style={styles.etiquetaResumen}>aprox.</AppText>
          </View>
        </View>
      </View>
      <View style={styles.notasResumen}>
        {error ? <View style={styles.avisoResumen}>
          <Icono nombre="info" tamanio={16} color={Colors.error} />
          <View style={styles.textoAviso}>
            <AppText style={styles.textoError} accessibilityLiveRegion="polite">{error}</AppText>
            <AppText style={styles.ayuda}>Se muestra la última ruta calculada.</AppText>
          </View>
        </View> : <View style={styles.avisoResumen}>
          {cargando
            ? <ActivityIndicator size="small" color={Colors.primary} style={styles.indicadorResumen} />
            : <Icono nombre={seguimientoActivo ? "myLocation" : "stop"} tamanio={16} color={Colors.primary} />}
          <AppText style={[styles.ayuda, styles.textoAviso]} accessibilityLiveRegion="polite">
            {cargando ? "Actualizando ruta…" : seguimientoActivo ? "Se actualiza al avanzar" : "Actualización en pausa"}
          </AppText>
        </View>}
        {ruta.aproximada && <View style={styles.avisoResumen}>
          <Icono nombre="info" tamanio={16} color={Colors.onSurfaceVariant} />
          <AppText style={[styles.ayuda, styles.textoAviso]}>Estimación basada en un trayecto en auto.</AppText>
        </View>}
      </View>
    </> : <View style={styles.estadoInicial}>
      <View style={[styles.iconoEstado, error && styles.iconoEstadoError]}>
        {cargando
          ? <ActivityIndicator size="small" color={Colors.primary} />
          : <Icono nombre={error ? "info" : "route"} tamanio={22} color={error ? Colors.error : Colors.primary} />}
      </View>
      <View style={styles.textoAviso}>
        <AppText weight="semibold" style={styles.tituloEstado} accessibilityLiveRegion="polite">
          {cargando ? fase : error ? "No pudimos obtener la ruta" : "Elige cómo llegar"}
        </AppText>
        {!cargando && <AppText style={error ? styles.textoError : styles.ayuda}>
          {error ?? "Calcularemos la ruta desde tu ubicación."}
        </AppText>}
      </View>
    </View>}
  </View>;

  const mapaExterno = <Chip
    titulo="Mapa externo"
    icono="openInNew"
    accessibilityLabel="Ver el paradero en un mapa externo"
    accessibilityHint="Abre la aplicación de mapas del dispositivo o el navegador."
    onPress={onAbrirMapaExterno}
    style={styles.mapaExterno}
  />;

  const seleccionarModo = (nuevoModo: ModoRuta) => {
    if (cargando || (automatico && modo === nuevoModo && !error)) return;
    if (modo !== nuevoModo) {
      // Evita presentar la geometría anterior como si fuera del nuevo modo.
      solicitud.current += 1;
      peticion.current?.abort();
      setRuta(null);
    }
    setError(null);
    setModo(nuevoModo);
    setAutomatico(true);
    setIntento((valor) => valor + 1);
  };

  const accionesMapa = <View style={styles.chips}>
    {(["caminando", "moto"] as const).map((opcion) => {
      const seleccionado = automatico && modo === opcion;
      const etiqueta = opcion === "moto" ? "en moto" : "a pie";
      return <Chip
        key={opcion}
        titulo={`${seleccionado && error ? "Reintentar" : "Cómo llegar"} ${etiqueta}`}
        icono={opcion === "moto" ? "twoWheeler" : "directionsWalk"}
        seleccionado={seleccionado}
        accessibilityLabel={`${seleccionado && error ? "Reintentar ruta" : "Cómo llegar"} ${etiqueta} al paradero`}
        cargando={seleccionado && cargando}
        disabled={!seleccionado && cargando}
        onPress={() => seleccionarModo(opcion)}
      />;
    })}
    {ampliado && mapaExterno}
  </View>;

  return <View style={styles.contenedor}>
    <AppText weight="semibold">Ruta al paradero</AppText>
    {!ampliado && <View style={styles.bloqueMapa}>
      {mapa(false)}
      <View style={styles.accionesBajoMapa}>
      {mapaExterno}
      <Pressable
        onPress={() => setAmpliado(true)}
        accessibilityRole="button"
        accessibilityLabel="Maximizar mapa de la ruta"
        accessibilityHint="Abre el mapa a pantalla completa para moverlo y cambiar el zoom"
        style={({ pressed }) => [styles.maximizarMapa, pressed && styles.presionado]}
      >
        <Icono nombre="fullscreen" tamanio={24} color={Colors.primary} />
        <AppText weight="semibold" style={styles.textoMaximizar}>Maximizar mapa</AppText>
      </Pressable>
      </View>
    </View>}
    {estado}
    {accionesMapa}
    <Modal visible={ampliado} animationType="slide" onRequestClose={() => setAmpliado(false)}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.encabezadoModal}>
          <AppText weight="semibold" style={styles.nombreParadero}>{nombre}</AppText>
          <Chip titulo="Cerrar" icono="close" accessibilityLabel="Cerrar mapa ampliado" onPress={() => setAmpliado(false)} />
        </View>
        {ampliado && mapa(true)}
        {estado}
        {accionesMapa}
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  contenedor: { margin: 12, gap: 12 },
  bloqueMapa: { gap: 8 },
  accionesBajoMapa: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  mapaExterno: { flex: 1, alignSelf: "stretch", minHeight: 48, borderRadius: 16, paddingHorizontal: 10 },
  maximizarMapa: {
    flex: 1.2,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.primaryContainer,
  },
  textoMaximizar: { fontSize: 15, color: Colors.primary, flexShrink: 1 },
  presionado: { opacity: 0.7 },
  estado: {
    padding: 14,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceSoft,
  },
  metricas: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  metrica: { flexGrow: 1, flexBasis: 120, gap: 5 },
  etiquetaMetrica: { flexDirection: "row", alignItems: "center", gap: 6 },
  etiquetaResumen: { fontSize: 12, color: Colors.onSurfaceVariant, flexShrink: 1 },
  valorMetrica: { fontSize: 22, color: Colors.brandDeep, flexShrink: 1 },
  tiempoResumen: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 5 },
  notasResumen: { borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, paddingTop: 10, gap: 8 },
  avisoResumen: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  textoAviso: { flex: 1, gap: 3 },
  ayuda: { fontSize: 12, lineHeight: 18, color: Colors.onSurfaceVariant },
  textoError: { fontSize: 12, lineHeight: 18, color: Colors.error },
  indicadorResumen: { width: 16, height: 18 },
  estadoInicial: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconoEstado: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  iconoEstadoError: { backgroundColor: Colors.errorContainerSoft },
  tituloEstado: { fontSize: 14, color: Colors.brandText },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  encabezadoModal: { flexDirection: "row", alignItems: "center", gap: 12 },
  nombreParadero: { flex: 1, color: Colors.brandText, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.surface, padding: 12, gap: 10 },
  completo: { flex: 1, height: undefined },
});
