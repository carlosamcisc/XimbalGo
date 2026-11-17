import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../../infrastructure/supabase/client";
import MapaReserva from "../../components/MapaReserva";
import type { MarcadorMapa } from "../../components/MapaSeguimiento";
import AppText from "../../components/AppText";
import Chip from "../../components/Chip";
import Colors from "../../theme/colors";
import { useRutaTaxi } from "../cliente/useRutaTaxi";
import { formatearDistancia } from "../../modules/cliente/ubicacion";
import { formatearMinutos } from "../../modules/cliente/seguimiento";
import { abrirEnMapa } from "../../infrastructure/location/location.service";

interface Paradero { id: string; nombre: string; latitud: number; longitud: number; orden: number }
interface MapaTaxista {
  rutaId: string | null;
  rutaNombre: string | null;
  taxi: MarcadorMapa | null;
  punto: MarcadorMapa | null;
  cliente: MarcadorMapa | null;
  clienteActualizadoEn: string | null;
  destino: (MarcadorMapa & { id: string }) | null;
  paraderos: Paradero[];
}
interface Catalogo { id: string; nombre: string; orden: number | null }

/** Compartido por Inicio y los detalles de una reserva del conductor. */
export default function MapaViajeTaxista({ reservaId, rutaId }: { reservaId?: string; rutaId?: string }) {
  const [mapa, setMapa] = useState<MapaTaxista | null>(null);
  const [paraderoId, setParaderoId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [activa, setActiva] = useState(AppState.currentState === "active");
  const enfocada = useIsFocused();
  const [configurando, setConfigurando] = useState(false);
  const [catalogo, setCatalogo] = useState<Catalogo[]>([]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [revision, setRevision] = useState(0);
  const guardandoRef = useRef(false);

  useEffect(() => {
    const listener = AppState.addEventListener("change", estado => {
      if (estado === "active") setActiva(true);
      if (estado === "background") setActiva(false);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => { setParaderoId(undefined); setMapa(null); }, [reservaId, rutaId]);

  useEffect(() => {
    if (!enfocada || !activa) { setMapa(null); return; }
    let cancelado = false;
    let ocupado = false;
    setMapa(null);
    const cargar = async () => {
      setMapa(actual => actual?.cliente && actual.clienteActualizadoEn &&
        Date.now() - Date.parse(actual.clienteActualizadoEn) >= 45_000 ? { ...actual, cliente: null } : actual);
      if (ocupado) return;
      ocupado = true;
      try {
        const { data, error: fallo } = await supabase.rpc("obtener_mapa_taxista", {
          ...(reservaId ? { p_reserva_id: reservaId } : {}),
          ...(paraderoId ? { p_paradero_id: paraderoId } : {}),
        });
        if (fallo || !data) throw new Error(fallo?.message ?? "No se pudo cargar el mapa.");
        if (!cancelado) {
          const nuevo = data as unknown as MapaTaxista;
          if (nuevo.cliente && (!nuevo.clienteActualizadoEn || Date.now() - Date.parse(nuevo.clienteActualizadoEn) >= 45_000)) nuevo.cliente = null;
          setMapa(nuevo);
          setError(null);
        }
      } catch (causa) {
        if (!cancelado) {
          // No se conserva una ubicación privada anterior si falla la conexión.
          setMapa(null);
          setError(causa instanceof Error ? causa.message : "No se pudo cargar el mapa.");
        }
      } finally { ocupado = false; }
    };
    void cargar();
    const intervalo = setInterval(() => void cargar(), 5_000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [reservaId, rutaId, paraderoId, revision, enfocada, activa]);

  const destino = mapa?.destino;
  const trayecto = useRutaTaxi(reservaId ?? "", mapa ? {
    taxistaId: "", enServicio: Boolean(mapa.taxi), taxi: mapa.taxi?.coordenadas ?? null,
    ubicacionActualizadaEn: null, tipoPunto: null, velocidadKmh: 0, punto: null,
    paraderoCercano: destino ? { nombre: destino.titulo, coordenadas: destino.coordenadas } : null,
  } : null, Boolean(destino && !configurando), { mapaTaxista: true, paraderoId: destino?.id });

  const configurar = async () => {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const { data, error: fallo } = await supabase.rpc("catalogo_paraderos_taxista");
      if (fallo) throw fallo;
      const lista = data as unknown as Catalogo[];
      setCatalogo(lista);
      setSeleccion(lista.filter(item => item.orden !== null).sort((a,b) => a.orden! - b.orden!).map(item => item.id));
      setConfigurando(true);
      setError(null);
    } catch { setError("No se pudieron consultar los paraderos. Reintenta."); }
    finally { setGuardando(false); guardandoRef.current = false; }
  };
  const guardar = async () => {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const { error: fallo } = await supabase.rpc("configurar_paraderos_taxista", { p_paraderos: seleccion });
      if (fallo) throw fallo;
      setConfigurando(false);
      setParaderoId(undefined);
      setRevision(valor => valor + 1);
      setError(null);
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No se pudieron guardar los paraderos."); }
    finally { setGuardando(false); guardandoRef.current = false; }
  };

  return <View style={styles.contenedor}>
    <View style={styles.encabezado}>
      <AppText weight="bold" style={styles.titulo}>{reservaId ? "Mapa del viaje" : "Mi recorrido"}</AppText>
      {!reservaId && <Chip titulo="Paraderos de mi ruta" icono="business" onPress={() => void configurar()} cargando={guardando} />}
    </View>
    <AppText style={styles.texto}>{mapa?.rutaNombre ?? "Selecciona una ruta en Mi perfil"}</AppText>
    {error && <AppText style={styles.error} accessibilityLiveRegion="polite">{error}</AppText>}
    {!mapa && !error && <ActivityIndicator color={Colors.primary} />}
    {mapa && <>
      {!mapa.paraderos.length && <View style={styles.aviso}>
        <AppText style={styles.texto}>Configura los paraderos de esta ruta en Inicio → Paraderos de mi ruta. No elegiremos un paradero ajeno a tu recorrido.</AppText>
      </View>}
      {mapa.paraderos.length > 0 && <>
        <AppText weight="semibold" style={styles.texto}>Elige el paradero al que te diriges</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.opciones}>
          {mapa.paraderos.map(paradero => <Chip key={paradero.id} titulo={`${paradero.orden}. ${paradero.nombre}`}
            seleccionado={destino?.id === paradero.id} onPress={() => setParaderoId(paradero.id)} />)}
        </ScrollView>
      </>}
      <MapaReserva titulo="Mi recorrido" taxi={mapa.taxi} punto={mapa.punto} cliente={mapa.cliente}
        etiquetaCliente="Cliente" paradero={destino} ruta={trayecto.ruta}>
        <View style={styles.aviso} accessibilityLiveRegion="polite">
          <AppText weight="semibold" style={styles.texto}>{destino ? `Hacia ${destino.titulo}` : "Sin paradero seleccionado"}</AppText>
          {!mapa.taxi && <AppText style={styles.texto}>Inicia tu servicio y activa el GPS para ver tu posición y calcular el trayecto.</AppText>}
          {trayecto.cargando && <AppText style={styles.texto}>Calculando recorrido por calles…</AppText>}
          {trayecto.estimacion && <AppText weight="bold" style={styles.metrica}>
            {formatearDistancia(trayecto.estimacion.distanciaMetros)} · {formatearMinutos(trayecto.estimacion.minutosRestantes)} aprox.
          </AppText>}
          {trayecto.error && <AppText style={styles.error}>{trayecto.error} {trayecto.ruta ? "Se muestra el último cálculo disponible." : ""}</AppText>}
          <AppText style={styles.texto}>Trayecto sugerido en auto hasta el paradero elegido. Revisa las condiciones de la vía antes de seguirlo.</AppText>
          {reservaId && <AppText style={styles.texto}>
            {mapa.cliente ? "Ubicación del cliente compartida. Se actualiza automáticamente cada 5 segundos."
              : "El cliente no está compartiendo una ubicación reciente. Puede activarla desde su reserva aceptada."}
          </AppText>}
          {destino && <Chip titulo="Abrir paradero en mapas" icono="openInNew" onPress={() => {
            void abrirEnMapa(destino.coordenadas, destino.titulo).catch(() => setError("No se pudo abrir la aplicación de mapas."));
          }} />}
        </View>
      </MapaReserva>
    </>}
    <Modal visible={configurando} animationType="slide" onRequestClose={() => { if (!guardando) setConfigurando(false); }}>
      <SafeAreaView style={styles.modal}>
        <AppText weight="bold" style={styles.titulo}>Paraderos de mi ruta</AppText>
        <AppText style={styles.texto}>Marca únicamente los paraderos por los que pasas, en orden. Para cambiar el orden, quítalos y vuelve a marcarlos.</AppText>
        <AppText style={styles.texto}>{seleccion.length} de 30 seleccionados</AppText>
        {error && <AppText style={styles.error}>{error}</AppText>}
        <ScrollView contentContainerStyle={styles.lista}>
          {catalogo.map(item => <Chip key={item.id}
            titulo={`${seleccion.includes(item.id) ? `${seleccion.indexOf(item.id) + 1}. ` : ""}${item.nombre}`}
            seleccionado={seleccion.includes(item.id)} disabled={guardando || (!seleccion.includes(item.id) && seleccion.length >= 30)}
            onPress={() => setSeleccion(actual => actual.includes(item.id) ? actual.filter(id => id !== item.id) : [...actual, item.id])} />)}
          {!catalogo.length && <AppText style={styles.texto}>No hay paraderos activos con ubicación.</AppText>}
        </ScrollView>
        <View style={styles.opciones}>
          <Chip titulo="Cancelar" disabled={guardando} onPress={() => setConfigurando(false)} />
          <Chip titulo="Guardar paraderos" cargando={guardando} onPress={() => void guardar()} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  contenedor: { gap: 12, paddingVertical: 12 },
  encabezado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titulo: { fontSize: 18, color: Colors.brandDeep },
  texto: { fontSize: 13, lineHeight: 19, color: Colors.onSurfaceVariant },
  error: { fontSize: 13, lineHeight: 19, color: Colors.error },
  aviso: { backgroundColor: Colors.primaryContainer, borderRadius: 16, padding: 14, marginTop: 10, gap: 8 },
  opciones: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  metrica: { fontSize: 22, color: Colors.brandDeep },
  modal: { flex: 1, padding: 16, gap: 12, backgroundColor: Colors.surface },
  lista: { gap: 10, paddingBottom: 16 },
});
