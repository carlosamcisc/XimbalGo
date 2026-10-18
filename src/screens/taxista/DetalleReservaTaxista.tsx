import { Linking, Pressable, StyleSheet, View } from "react-native";
import AppText from "../../components/AppText";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import {
  PRESENTACION_ESTADO,
  formatearAsientos,
  formatearFecha,
  formatearPrecio,
} from "../../modules/cliente/reservas";
import {
  DESCRIPCION_ESTADO_TAXISTA,
  PRESENTACION_ACCION,
  accionesDisponibles,
  esperaRespuestaOferta,
  puedeOfrecerAsientos,
  type ReservaTaxista,
} from "../../modules/taxista/types";
import { textoAsientos } from "../../modules/cliente/reservas";
import { useTaxista } from "./TaxistaContext";
import type { AccionesReserva } from "./useAccionReserva";

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
  acciones: AccionesReserva;
}

export default function DetalleReservaTaxista({ reservaId, onClose, acciones }: Props) {
  const { reservas, procesandoReservaId, procesandoAccion } = useTaxista();
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
          {esperaRespuestaOferta(reserva) && (
            <View style={styles.aviso}>
              <AppText style={styles.textoAviso}>
                Ofreciste {textoAsientos(reserva.asientosOfrecidos!)} de los {reserva.cantidadAsientos} que pidió.
                Esperando a que el cliente acepte o cancele.
              </AppText>
            </View>
          )}

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
          <DetalleFila
            icono="eventSeat"
            etiqueta={reserva.cantidadAsientos === 1 ? "Asiento" : "Asientos"}
            valor={[
              formatearAsientos(reserva.cantidadAsientos, reserva.numerosAsientos),
              reserva.matricula,
            ].filter(Boolean).join(" · ")}
          />
          <DetalleFila
            icono="calendar"
            etiqueta="Viaje"
            valor={reserva.fechaViaje ? formatearFecha(reserva.fechaViaje) : "En cuanto pases"}
          />
          <DetalleFila
            icono="schedule"
            etiqueta="Solicitada"
            valor={formatearFecha(reserva.fechaReserva)}
          />
          {precio && <DetalleFila icono="payments" etiqueta="Precio" valor={precio} />}
          {reserva.notas && <DetalleFila icono="notes" etiqueta="Notas" valor={reserva.notas} />}
          {reserva.motivoTaxista && (
            <DetalleFila icono="info" etiqueta="Motivo que le diste al cliente" valor={reserva.motivoTaxista} />
          )}

          <View style={styles.acciones}>
            {accionesDisponibles(reserva).map((accion) => {
              const presentacion = PRESENTACION_ACCION[accion];
              return (
                <Button
                  key={accion}
                  titulo={procesando && procesandoAccion === accion ? "Procesando..." : presentacion.etiqueta}
                  disabled={procesando}
                  color={presentacion.peligrosa ? Colors.danger : Colors.primary}
                  borderColor={presentacion.peligrosa ? Colors.danger : Colors.primary}
                  onPress={() => {
                    // La confirmación y el motivo se muestran sin el detalle
                    // abierto: un `Alert` encima de un `Modal` puede dejar la
                    // pantalla sin responder a toques en Android.
                    if (presentacion.confirmacion || presentacion.motivo) {
                      onClose();
                      acciones.ejecutar(reserva.id, accion, { desdePanel: true });
                      return;
                    }
                    // Al terminar se cierra el detalle para volver a la lista
                    // ya actualizada.
                    acciones.ejecutar(reserva.id, accion, { onExito: onClose });
                  }}
                />
              );
            })}
            {puedeOfrecerAsientos(reserva) && (
              <Button
                titulo="Ofrecer menos asientos"
                color={Colors.brandDeep}
                borderColor={Colors.brandDeep}
                disabled={procesando}
                onPress={() => {
                  onClose();
                  acciones.ofrecer(reserva.id, true);
                }}
              />
            )}
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
  aviso: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
  },
  textoAviso: {
    fontSize: 13,
    color: Colors.brandText,
  },
  acciones: {
    marginTop: 8,
  },
});
