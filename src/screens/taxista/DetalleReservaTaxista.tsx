import { Linking, Pressable, StyleSheet, View } from "react-native";
import AppText from "../../components/AppText";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import {
  PRESENTACION_ESTADO,
  formatearFecha,
  formatearPrecio,
} from "../../modules/cliente/reservas";
import {
  DESCRIPCION_ESTADO_TAXISTA,
  PRESENTACION_ACCION,
  accionesDisponibles,
  type ReservaTaxista,
} from "../../modules/taxista/types";
import { useTaxista } from "./TaxistaContext";
import { useAccionReserva } from "./useAccionReserva";

const DetalleFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
  <View style={styles.detalleFila}>
    <Icono nombre={icono} tamanio={20} color={Colors.primary} />
    <View style={styles.detalleTexto}>
      <AppText style={styles.detalleEtiqueta}>{etiqueta}</AppText>
      <AppText weight="medium" style={styles.detalleValor}>{valor}</AppText>
    </View>
  </View>
);

interface Props {
  /** Se busca por id para reflejar los cambios en tiempo real. */
  reservaId: string | null;
  onClose: () => void;
}

export default function DetalleReservaTaxista({ reservaId, onClose }: Props) {
  const { reservas, procesandoReservaId } = useTaxista();
  const ejecutarAccion = useAccionReserva();
  const reserva: ReservaTaxista | undefined = reservas.find((item) => item.id === reservaId);
  const procesando = reserva !== undefined && procesandoReservaId === reserva.id;

  const llamar = async (telefono: string) => {
    try {
      await Linking.openURL(`tel:${telefono}`);
    } catch {
      ToastMessage.show("No se pudo abrir la app de teléfono.");
    }
  };

  const estado = reserva ? PRESENTACION_ESTADO[reserva.estado] : null;
  const precio = reserva ? formatearPrecio(reserva.precio) : null;

  return (
    <BottomSheet visible={reserva !== undefined} onClose={onClose}>
      {reserva && estado && (
        <View>
          <View style={styles.encabezado}>
            <AppText weight="semibold" style={styles.titulo}>Detalle del viaje</AppText>
            <View style={[styles.estado, { backgroundColor: estado.fondo }]}>
              <AppText weight="semibold" style={[styles.textoEstado, { color: estado.color }]}>
                {estado.etiqueta}
              </AppText>
            </View>
          </View>
          <AppText style={styles.descripcion}>{DESCRIPCION_ESTADO_TAXISTA[reserva.estado]}</AppText>

          <DetalleFila icono="person" etiqueta="Cliente" valor={reserva.nombreCliente} />
          {reserva.telefonoCliente && (
            <Pressable
              onPress={() => void llamar(reserva.telefonoCliente!)}
              accessibilityRole="button"
              accessibilityLabel={`Llamar a ${reserva.nombreCliente}`}
            >
              <DetalleFila icono="phone" etiqueta="Teléfono (toca para llamar)" valor={reserva.telefonoCliente} />
            </Pressable>
          )}
          <DetalleFila
            icono="locationHistory"
            etiqueta="Origen"
            valor={reserva.origen ?? "Ubicación del cliente (ver notas)"}
          />
          <DetalleFila icono="locationOn" etiqueta="Destino" valor={reserva.destino ?? "Paradero no disponible"} />
          {reserva.numeroAsiento !== null && (
            <DetalleFila
              icono="eventSeat"
              etiqueta="Asiento"
              valor={[`Número ${reserva.numeroAsiento}`, reserva.matricula].filter(Boolean).join(" · ")}
            />
          )}
          <DetalleFila
            icono="schedule"
            etiqueta={reserva.fechaViaje ? "Fecha del viaje" : "Solicitada"}
            valor={formatearFecha(reserva.fechaViaje ?? reserva.fechaReserva)}
          />
          {precio && <DetalleFila icono="payments" etiqueta="Precio" valor={precio} />}
          {reserva.notas && <DetalleFila icono="notes" etiqueta="Notas" valor={reserva.notas} />}

          <View style={styles.acciones}>
            {accionesDisponibles(reserva.estado).map((accion) => {
              const presentacion = PRESENTACION_ACCION[accion];
              return (
                <Button
                  key={accion}
                  titulo={procesando ? "Procesando..." : presentacion.etiqueta}
                  disabled={procesando}
                  color={presentacion.peligrosa ? Colors.danger : Colors.primary}
                  borderColor={presentacion.peligrosa ? Colors.danger : Colors.primary}
                  onPress={() => ejecutarAccion(reserva.id, accion)}
                />
              );
            })}
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titulo: {
    fontSize: 18,
    flexShrink: 1,
  },
  estado: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  textoEstado: {
    fontSize: 12,
  },
  descripcion: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
    marginBottom: 8,
  },
  detalleFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detalleTexto: {
    flex: 1,
  },
  detalleEtiqueta: {
    fontSize: 12,
    color: Colors.outline,
  },
  detalleValor: {
    fontSize: 14,
    color: Colors.brandText,
  },
  acciones: {
    marginTop: 8,
  },
});
