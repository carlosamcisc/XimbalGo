import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import MapaSeguimiento from "../../components/MapaSeguimiento";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import {
  PRESENTACION_ESTADO,
  formatearAsientos,
  formatearFecha,
  formatearHora,
  formatearPrecio,
  precioOferta,
  puedeCancelarse,
  textoAsientos,
  tieneOfertaAsientos,
  type ReservaCliente,
} from "../../modules/cliente/reservas";
import {
  distanciaEntre,
  estimarLlegada,
  formatearAntiguedad,
  formatearMinutos,
  type EstimacionLlegada,
  type SeguimientoReserva,
} from "../../modules/cliente/seguimiento";
import { formatearDistancia } from "../../modules/cliente/ubicacion";
import { useClienteReserva } from "./useClienteReserva";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteReserva">;

// Si el paradero cercano está a menos de esto del punto, es el mismo lugar.
const METROS_MISMO_PUNTO = 60;
// Margen para decir que el viaje está programado para más tarde.
const MINUTOS_PROGRAMADO = 10;

const DetalleFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
  <View style={styles.detalleFila}>
    <Icono nombre={icono} tamanio={20} color={Colors.primary} />
    <View style={styles.detalleTexto}>
      <AppText style={styles.detalleEtiqueta}>{etiqueta}</AppText>
      <AppText weight="medium" style={styles.detalleValor}>{valor}</AppText>
    </View>
  </View>
);

const Dato = ({ valor, etiqueta }: { valor: string; etiqueta: string }) => (
  <View style={styles.dato}>
    <AppText weight="bold" style={styles.valorDato}>{valor}</AppText>
    <AppText style={styles.etiquetaDato}>{etiqueta}</AppText>
  </View>
);

const textoSinEstimacion = (seguimiento: SeguimientoReserva | null, error: string | null) => {
  if (error) {
    return error;
  }
  if (!seguimiento || !seguimiento.enServicio || !seguimiento.taxi) {
    return "El taxista no está compartiendo su ubicación ahora. Se mostrará en cuanto inicie su servicio o abra la app.";
  }
  return "No tenemos tu punto de abordaje en el mapa. Usa «Mi ubicación actual» o un paradero como origen para ver el tiempo de llegada.";
};

const ClienteReservaScreen = ({ navigation, route }: Props) => {
  const { reservaId } = route.params;
  const detalle = useClienteReserva(reservaId);
  const { reserva, seguimiento, estimacion, ahora } = detalle;
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const [confirmandoRechazoOferta, setConfirmandoRechazoOferta] = useState(false);

  const responderOferta = async (acepta: boolean) => {
    const error = await detalle.responderOferta(acepta);
    setConfirmandoRechazoOferta(false);
    if (error) {
      ToastMessage.show(error, "long");
      return;
    }
    ToastMessage.show(acepta ? "¡Listo! Tu reservación quedó aceptada." : "Solicitud cancelada");
  };

  const renderOferta = (oferta: ReservaCliente) => {
    const ofrecidos = oferta.asientosOfrecidos!;
    const total = formatearPrecio(precioOferta(oferta));
    const anterior = formatearPrecio(oferta.precio);
    const respondiendo = detalle.respondiendo !== null;
    return (
      <Card>
        <View style={styles.encabezadoOferta}>
          <Icono nombre="eventSeat" tamanio={22} color={Colors.primary} />
          <AppText weight="semibold" style={styles.tituloSeccion}>
            El taxista solo tiene {textoAsientos(ofrecidos)}
          </AppText>
        </View>
        <AppText style={styles.textoOferta}>
          Pediste {textoAsientos(oferta.cantidadAsientos)}, pero al taxista solo le{" "}
          {ofrecidos === 1 ? "queda 1 disponible" : `quedan ${ofrecidos} disponibles`}. ¿Quieres reservar{" "}
          {ofrecidos === 1 ? "ese asiento" : `esos ${ofrecidos}`}? Tú decides.
        </AppText>
        {total && (
          <View style={styles.totalOferta}>
            <AppText style={styles.detalleEtiqueta}>Nuevo total</AppText>
            <View style={styles.preciosOferta}>
              {anterior && <AppText style={styles.precioAnterior}>{anterior}</AppText>}
              <AppText weight="bold" style={styles.precioNuevo}>{total}</AppText>
            </View>
          </View>
        )}
        {confirmandoRechazoOferta ? (
          <View style={styles.confirmacion}>
            <AppText style={styles.textoConfirmacion}>
              Si no aceptas, tu solicitud se cancelará y podrás buscar otro taxi.
            </AppText>
            <Button
              titulo={detalle.respondiendo === false ? "Cancelando..." : "Sí, cancelar solicitud"}
              color={Colors.danger}
              borderColor={Colors.danger}
              disabled={respondiendo}
              onPress={() => void responderOferta(false)}
            />
            <Pressable
              onPress={() => setConfirmandoRechazoOferta(false)}
              disabled={respondiendo}
              accessibilityRole="button"
              style={styles.botonSecundario}
            >
              <AppText weight="semibold" style={styles.enlace}>Volver</AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <Button
              titulo={detalle.respondiendo === true ? "Aceptando..." : `Aceptar ${textoAsientos(ofrecidos)}`}
              disabled={respondiendo}
              onPress={() => void responderOferta(true)}
            />
            <Pressable
              onPress={() => setConfirmandoRechazoOferta(true)}
              disabled={respondiendo}
              accessibilityRole="button"
              style={styles.botonSecundario}
            >
              <AppText weight="semibold" style={styles.textoRechazarOferta}>No acepto, cancelar solicitud</AppText>
            </Pressable>
          </>
        )}
      </Card>
    );
  };

  const llamar = async (telefono: string) => {
    try {
      await Linking.openURL(`tel:${telefono}`);
    } catch {
      ToastMessage.show("No se pudo abrir la app de teléfono.");
    }
  };

  const confirmarCancelacion = async () => {
    const error = await detalle.cancelar();
    setConfirmandoCancelacion(false);
    ToastMessage.show(error ?? "Reservación cancelada");
  };

  const renderSeguimiento = () => {
    if (!detalle.activa) {
      return null;
    }

    const paradero = seguimiento?.paraderoCercano ?? null;
    const punto = seguimiento?.punto ?? null;
    const paraderoDistinto =
      paradero !== null &&
      (punto === null || distanciaEntre(paradero.coordenadas, punto.coordenadas) > METROS_MISMO_PUNTO);
    const estimacionParadero: EstimacionLlegada | null =
      seguimiento && paradero && paraderoDistinto
        ? estimarLlegada({ ...seguimiento, punto: paradero }, ahora)
        : null;
    const programado =
      reserva?.fechaViaje && estimacion &&
      new Date(reserva.fechaViaje).getTime() - estimacion.llegada.getTime() > MINUTOS_PROGRAMADO * 60_000;

    return (
      <Card>
        <View style={styles.encabezadoSeguimiento}>
          <AppText weight="semibold" style={styles.tituloSeccion}>Seguimiento en tiempo real</AppText>
          {seguimiento?.enServicio && seguimiento.taxi && (
            <View style={styles.enVivo}>
              <View style={styles.puntoEnVivo} />
              <AppText weight="semibold" style={styles.textoEnVivo}>En vivo</AppText>
            </View>
          )}
        </View>

        {estimacion ? (
          <>
            <AppText style={styles.textoLlegada}>
              {estimacion.llegando
                ? `El taxi está llegando a ${punto?.nombre ?? "tu punto de abordaje"}`
                : `El taxi pasará por ${punto?.nombre ?? "tu punto de abordaje"}`}
            </AppText>
            <View style={styles.datos}>
              <Dato valor={formatearHora(estimacion.llegada)} etiqueta="Hora estimada" />
              <Dato
                valor={estimacion.llegando ? "Ya" : formatearMinutos(estimacion.minutosRestantes)}
                etiqueta="Faltan"
              />
              <Dato valor={formatearDistancia(estimacion.distanciaMetros)} etiqueta="Distancia" />
            </View>
            {programado && reserva?.fechaViaje && (
              <AppText style={styles.textoAyuda}>
                Tu viaje está programado para {formatearFecha(reserva.fechaViaje)}. El tiempo se calcula con la ubicación actual del taxi.
              </AppText>
            )}
          </>
        ) : (
          <AppText style={styles.textoAyuda}>
            {textoSinEstimacion(seguimiento, detalle.errorSeguimiento)}
          </AppText>
        )}

        {paradero && paraderoDistinto && (
          <View style={styles.paradero}>
            <Icono nombre="business" tamanio={20} color={Colors.brandDeep} />
            <View style={styles.detalleTexto}>
              <AppText weight="medium" style={styles.detalleValor}>Paradero cercano: {paradero.nombre}</AppText>
              <AppText style={styles.detalleEtiqueta}>
                {[
                  punto && `A ${formatearDistancia(distanciaEntre(paradero.coordenadas, punto.coordenadas))} de tu punto`,
                  estimacionParadero &&
                    `El taxi pasa ${estimacionParadero.llegando
                      ? "ya"
                      : `a las ${formatearHora(estimacionParadero.llegada)} (${formatearMinutos(estimacionParadero.minutosRestantes)})`}`,
                ].filter(Boolean).join(" · ")}
              </AppText>
            </View>
          </View>
        )}

        <MapaSeguimiento
          style={styles.mapa}
          taxi={seguimiento?.taxi ? {
            coordenadas: seguimiento.taxi,
            titulo: reserva?.matricula ? `Taxi ${reserva.matricula}` : "Taxi",
          } : null}
          punto={punto ? { coordenadas: punto.coordenadas, titulo: punto.nombre } : null}
          paradero={paradero && paraderoDistinto
            ? { coordenadas: paradero.coordenadas, titulo: paradero.nombre }
            : null}
        />
        {seguimiento?.ubicacionActualizadaEn && seguimiento.taxi && (
          <AppText style={styles.textoAyuda}>
            Ubicación del taxi actualizada {formatearAntiguedad(seguimiento.ubicacionActualizadaEn, ahora)}.
            Estimación en línea recta con la velocidad promedio de la ruta.
          </AppText>
        )}
      </Card>
    );
  };

  const renderContenido = () => {
    if (detalle.cargando && !reserva) {
      return (
        <View style={styles.estadoLista}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando tu reservación...</AppText>
        </View>
      );
    }
    if (!reserva) {
      return (
        <Card>
          <View style={styles.estadoLista}>
            <AppText style={styles.textoEstado}>{detalle.error ?? "No se pudo cargar la reservación."}</AppText>
            <Pressable onPress={() => void detalle.cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }

    const estado = PRESENTACION_ESTADO[reserva.estado];
    const precio = formatearPrecio(reserva.precio);
    const oferta = tieneOfertaAsientos(reserva);

    return (
      <>
        <Card>
          <View style={styles.encabezadoDetalle}>
            <AppText weight="semibold" style={styles.tituloSeccion}>Tu reservación</AppText>
            <View style={[styles.estado, { backgroundColor: estado.fondo }]}>
              <AppText weight="semibold" style={[styles.textoEstadoBadge, { color: estado.color }]}>
                {estado.etiqueta}
              </AppText>
            </View>
          </View>
          <AppText style={styles.descripcionEstado}>
            {oferta ? "El taxista respondió a tu solicitud. Revisa su oferta." : estado.descripcion}
          </AppText>
          {reserva.motivoTaxista && (
            <View style={styles.motivo}>
              <Icono nombre="info" tamanio={20} color={Colors.error} />
              <View style={styles.detalleTexto}>
                <AppText style={styles.detalleEtiqueta}>Motivo del taxista</AppText>
                <AppText weight="medium" style={styles.detalleValor}>{reserva.motivoTaxista}</AppText>
              </View>
            </View>
          )}
        </Card>

        {oferta && renderOferta(reserva)}

        {renderSeguimiento()}

        <Card>
          <AppText weight="semibold" style={styles.tituloSeccion}>Detalles</AppText>
          <DetalleFila icono="locationHistory" etiqueta="Origen" valor={reserva.origen ?? "Mi ubicación"} />
          <DetalleFila icono="locationOn" etiqueta="Destino" valor={reserva.destino ?? "Paradero no disponible"} />
          <DetalleFila
            icono="eventSeat"
            etiqueta={reserva.cantidadAsientos === 1 ? "Asiento" : "Asientos"}
            valor={formatearAsientos(reserva.cantidadAsientos, reserva.numerosAsientos)}
          />
          <DetalleFila
            icono="calendar"
            etiqueta="Fecha y hora del viaje"
            valor={reserva.fechaViaje ? formatearFecha(reserva.fechaViaje) : "Lo antes posible"}
          />
          <DetalleFila
            icono="localTaxi"
            etiqueta="Taxi"
            valor={[reserva.matricula, reserva.vehiculo].filter(Boolean).join(" · ") || "No disponible"}
          />
          {reserva.nombreTaxista && (
            reserva.telefonoTaxista && detalle.activa ? (
              <Pressable
                onPress={() => void llamar(reserva.telefonoTaxista!)}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${reserva.nombreTaxista}`}
              >
                <DetalleFila
                  icono="phone"
                  etiqueta="Taxista (toca para llamar)"
                  valor={`${reserva.nombreTaxista} · ${reserva.telefonoTaxista}`}
                />
              </Pressable>
            ) : (
              <DetalleFila icono="person" etiqueta="Taxista" valor={reserva.nombreTaxista} />
            )
          )}
          {precio && <DetalleFila icono="payments" etiqueta="Precio total" valor={precio} />}
          <DetalleFila icono="schedule" etiqueta="Solicitada" valor={formatearFecha(reserva.fechaReserva)} />
          {reserva.notas && <DetalleFila icono="notes" etiqueta="Notas" valor={reserva.notas} />}

          {/* Con una oferta pendiente, «No acepto» ya cancela la solicitud. */}
          {puedeCancelarse(reserva.estado) && !oferta && (
            confirmandoCancelacion ? (
              <View style={styles.confirmacion}>
                <AppText style={styles.textoConfirmacion}>
                  ¿Seguro que quieres cancelar? Tus asientos quedarán libres para otros pasajeros.
                </AppText>
                <Button
                  titulo={detalle.cancelando ? "Cancelando..." : "Sí, cancelar reservación"}
                  color={Colors.danger}
                  borderColor={Colors.danger}
                  disabled={detalle.cancelando}
                  onPress={() => void confirmarCancelacion()}
                />
                <Pressable
                  onPress={() => setConfirmandoCancelacion(false)}
                  disabled={detalle.cancelando}
                  accessibilityRole="button"
                  style={styles.botonSecundario}
                >
                  <AppText weight="semibold" style={styles.enlace}>Conservar reservación</AppText>
                </Pressable>
              </View>
            ) : (
              <Button
                titulo="Cancelar reservación"
                color={Colors.danger}
                borderColor={Colors.danger}
                onPress={() => setConfirmandoCancelacion(true)}
              />
            )
          )}
        </Card>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo="Mi reservación"
        subtitulo="Detalles y seguimiento de tu taxi"
        onBack={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ClienteReservaciones")}
      />
      <View style={styles.pantalla}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={detalle.refrescando}
              onRefresh={() => void detalle.refrescar()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {renderContenido()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: Colors.primary,
    flex: 1,
  },
  pantalla: {
    backgroundColor: Colors.surface,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  estadoLista: {
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  textoEstado: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
  },
  enlace: {
    fontSize: 14,
    color: Colors.primary,
  },
  tituloSeccion: {
    fontSize: 16,
    color: Colors.brandDeep,
    flexShrink: 1,
  },
  encabezadoDetalle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  estado: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  textoEstadoBadge: {
    fontSize: 12,
  },
  descripcionEstado: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 6,
  },
  motivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.errorContainerSoft,
  },
  encabezadoOferta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textoOferta: {
    fontSize: 14,
    color: Colors.brandText,
    marginTop: 8,
  },
  totalOferta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  preciosOferta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  precioAnterior: {
    fontSize: 13,
    color: Colors.outline,
    textDecorationLine: "line-through",
  },
  precioNuevo: {
    fontSize: 17,
    color: Colors.brandDeep,
  },
  textoRechazarOferta: {
    fontSize: 14,
    color: Colors.danger,
  },
  encabezadoSeguimiento: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  enVivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: Colors.brandAccentContainer,
  },
  puntoEnVivo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  textoEnVivo: {
    fontSize: 11,
    color: Colors.success,
  },
  textoLlegada: {
    fontSize: 14,
    color: Colors.brandText,
  },
  datos: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
  },
  dato: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.primaryContainer,
  },
  valorDato: {
    fontSize: 18,
    color: Colors.brandDeep,
  },
  etiquetaDato: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  textoAyuda: {
    fontSize: 12,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    marginVertical: 6,
  },
  paradero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  mapa: {
    marginTop: 6,
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
  confirmacion: {
    marginTop: 12,
  },
  textoConfirmacion: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.onSurface,
  },
  botonSecundario: {
    alignItems: "center",
    paddingVertical: 8,
  },
});

export default ClienteReservaScreen;
