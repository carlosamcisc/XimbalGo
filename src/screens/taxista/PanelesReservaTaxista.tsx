import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import AppText from "../../components/AppText";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import SelectorAsientos from "../../components/SelectorAsientos";
import Colors from "../../theme/colors";
import { formatearPrecio, textoAsientos } from "../../modules/cliente/reservas";
import {
  MAXIMO_MOTIVO,
  MOTIVOS_CANCELACION,
  MOTIVOS_RECHAZO,
  PRESENTACION_ACCION,
  puedeOfrecerAsientos,
  type AccionReserva,
  type ReservaTaxista,
} from "../../modules/taxista/types";
import { useTaxista } from "./TaxistaContext";
import type { AccionesReserva } from "./useAccionReserva";

const OTRO_MOTIVO = "Otro motivo";

const Opcion = ({ texto, seleccionada, onPress }: {
  texto: string;
  seleccionada: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: seleccionada }}
    style={({ pressed }) => [styles.opcion, seleccionada && styles.opcionSeleccionada, pressed && styles.presionado]}
  >
    <View style={[styles.radio, seleccionada && styles.radioSeleccionado]}>
      {seleccionada && <View style={styles.radioPunto} />}
    </View>
    <AppText style={styles.textoOpcion}>{texto}</AppText>
  </Pressable>
);

function PanelMotivo({ reserva, accion, procesando, onConfirmar, onCerrar, onOfrecer }: {
  reserva: ReservaTaxista;
  accion: AccionReserva;
  procesando: boolean;
  onConfirmar: (motivo: string | null) => void;
  onCerrar: () => void;
  onOfrecer: () => void;
}) {
  const presentacion = PRESENTACION_ACCION[accion];
  const obligatorio = presentacion.motivo?.obligatorio ?? false;
  const motivos = accion === "rechazada" ? MOTIVOS_RECHAZO : MOTIVOS_CANCELACION;
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [otro, setOtro] = useState("");

  const motivo = seleccion === OTRO_MOTIVO ? otro.trim() || null : seleccion;
  const valido = !obligatorio || motivo !== null;
  const etiquetaConfirmar = accion === "rechazada" ? "Rechazar solicitud" : "Cancelar viaje";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <AppText weight="semibold" style={styles.titulo}>{presentacion.motivo?.titulo}</AppText>
      <AppText style={styles.ayuda}>
        {reserva.nombreCliente} verá este motivo en su reservación.
        {accion === "cancelada_taxista" && " Es opcional."}
        {" "}{reserva.cantidadAsientos === 1 ? "El asiento quedará libre." : "Los asientos quedarán libres."}
      </AppText>

      {accion === "rechazada" && puedeOfrecerAsientos(reserva) && (
        <Pressable onPress={onOfrecer} accessibilityRole="button" style={styles.sugerencia}>
          <AppText style={styles.textoSugerencia}>
            ¿No tienes los {reserva.cantidadAsientos} asientos?{" "}
            <AppText weight="semibold" style={styles.enlace}>Ofrece los que te quedan</AppText>
          </AppText>
        </Pressable>
      )}

      <View accessibilityRole="radiogroup" style={styles.opciones}>
        {[...motivos, OTRO_MOTIVO].map((texto) => (
          <Opcion
            key={texto}
            texto={texto}
            seleccionada={seleccion === texto}
            onPress={() => setSeleccion(seleccion === texto && !obligatorio ? null : texto)}
          />
        ))}
      </View>
      {seleccion === OTRO_MOTIVO && (
        <TextInput
          style={styles.campo}
          value={otro}
          onChangeText={setOtro}
          placeholder="Escribe el motivo para el cliente"
          placeholderTextColor={Colors.outline}
          maxLength={MAXIMO_MOTIVO}
          multiline
          autoFocus
          editable={!procesando}
          accessibilityLabel="Motivo para el cliente"
        />
      )}

      <Button
        titulo={procesando ? "Procesando..." : etiquetaConfirmar}
        color={Colors.danger}
        borderColor={Colors.danger}
        disabled={!valido || procesando}
        onPress={() => onConfirmar(motivo)}
      />
      <Pressable onPress={onCerrar} disabled={procesando} accessibilityRole="button" style={styles.botonSecundario}>
        <AppText weight="semibold" style={styles.enlace}>Volver</AppText>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function PanelOferta({ reserva, procesando, onConfirmar, onCerrar }: {
  reserva: ReservaTaxista;
  procesando: boolean;
  onConfirmar: (cantidad: number) => void;
  onCerrar: () => void;
}) {
  const maximo = reserva.cantidadAsientos - 1;
  const [cantidad, setCantidad] = useState(maximo);
  const sobrantes = reserva.cantidadAsientos - cantidad;
  const total = reserva.precio === null
    ? null
    : formatearPrecio((reserva.precio / reserva.cantidadAsientos) * cantidad);

  return (
    <View>
      <AppText weight="semibold" style={styles.titulo}>Ofrecer los asientos que te quedan</AppText>
      <AppText style={styles.ayuda}>
        {reserva.nombreCliente} pidió {textoAsientos(reserva.cantidadAsientos)}. ¿Cuántos tienes disponibles para este viaje?
      </AppText>

      <SelectorAsientos cantidad={cantidad} maximo={maximo} onCambiar={setCantidad} disabled={procesando} />

      {total && (
        <View style={styles.resumen}>
          <AppText style={styles.etiquetaResumen}>Nuevo total para el cliente</AppText>
          <AppText weight="semibold" style={styles.valorResumen}>{total}</AppText>
        </View>
      )}
      <AppText style={styles.nota}>
        El cliente decidirá si acepta. {sobrantes === 1 ? "El otro asiento quedará marcado" : `Los otros ${sobrantes} asientos quedarán marcados`} como
        ocupados; puedes liberarlos después en Vehículo.
      </AppText>

      <Button
        titulo={procesando ? "Enviando..." : `Ofrecer ${textoAsientos(cantidad)}`}
        disabled={procesando}
        onPress={() => onConfirmar(cantidad)}
      />
      <Pressable onPress={onCerrar} disabled={procesando} accessibilityRole="button" style={styles.botonSecundario}>
        <AppText weight="semibold" style={styles.enlace}>Volver</AppText>
      </Pressable>
    </View>
  );
}

/** Paneles de motivo y de oferta de asientos que abre `useAccionReserva`. */
export default function PanelesReservaTaxista({ acciones }: { acciones: AccionesReserva }) {
  const { reservas, procesandoReservaId } = useTaxista();
  const { panel } = acciones;
  const reserva = panel ? reservas.find((item) => item.id === panel.reservaId) : undefined;
  const procesando = reserva !== undefined && procesandoReservaId === reserva.id;

  // Si la reserva cambia en tiempo real (el cliente cancela, otra pantalla la
  // responde), el panel ya no aplica.
  const vigente =
    reserva !== undefined &&
    (panel?.tipo === "oferta"
      ? puedeOfrecerAsientos(reserva)
      : reserva.estado === (panel?.accion === "rechazada" ? "pendiente" : "aceptada"));
  const { cerrarPanel } = acciones;
  useEffect(() => {
    if (panel && !vigente && !procesando) {
      cerrarPanel();
    }
  }, [panel, vigente, procesando, cerrarPanel]);

  return (
    <BottomSheet visible={panel !== null && vigente} onClose={() => !procesando && cerrarPanel()}>
      {reserva && panel?.tipo === "motivo" && (
        <PanelMotivo
          key={`${panel.reservaId}-${panel.accion}`}
          reserva={reserva}
          accion={panel.accion}
          procesando={procesando}
          onConfirmar={(motivo) => void acciones.confirmarMotivo(motivo)}
          onCerrar={cerrarPanel}
          onOfrecer={() => {
            cerrarPanel();
            acciones.ofrecer(reserva.id, true);
          }}
        />
      )}
      {reserva && panel?.tipo === "oferta" && (
        <PanelOferta
          key={panel.reservaId}
          reserva={reserva}
          procesando={procesando}
          onConfirmar={(cantidad) => void acciones.confirmarOferta(cantidad)}
          onCerrar={cerrarPanel}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 18,
    color: Colors.brandText,
  },
  ayuda: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
    marginBottom: 10,
  },
  sugerencia: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
  },
  textoSugerencia: {
    fontSize: 13,
    color: Colors.brandText,
  },
  opciones: {
    gap: 6,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.white,
  },
  opcionSeleccionada: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
  presionado: {
    backgroundColor: Colors.surfaceSoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSeleccionado: {
    borderColor: Colors.primary,
  },
  radioPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  textoOpcion: {
    flex: 1,
    fontSize: 14,
    color: Colors.brandText,
  },
  campo: {
    minHeight: 64,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    textAlignVertical: "top",
  },
  resumen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  etiquetaResumen: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  valorResumen: {
    fontSize: 16,
    color: Colors.brandDeep,
  },
  nota: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  enlace: {
    fontSize: 14,
    color: Colors.primary,
  },
  botonSecundario: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
