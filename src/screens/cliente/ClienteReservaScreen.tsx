import AnimacionEstado from "../../components/AnimacionEstado";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import MapaReserva from "../../components/MapaReserva";
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
  formatearAntiguedad,
  formatearMinutos,
  type SeguimientoReserva,
} from "../../modules/cliente/seguimiento";
import { formatearDistancia } from "../../modules/cliente/ubicacion";
import { useClienteReserva } from "./useClienteReserva";
import { useRutaTaxi } from "./useRutaTaxi";
import { useUbicacionClienteMapa } from "./useUbicacionClienteMapa";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteReserva">;

// Si el paradero cercano está a menos de esto del punto, es el mismo lugar.
const METROS_MISMO_PUNTO = 60;
// Margen para decir que el viaje está programado para más tarde.
const MINUTOS_PROGRAMADO = 10;

const DetalleFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
  <View style={styles.detalleFila}>
    <View style={styles.detalleIcono}><Icono nombre={icono} tamanio={20} color={Colors.primary} /></View>
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
  const { reserva, seguimiento, ahora } = detalle;
  const rutaTaxi = useRutaTaxi(reservaId, seguimiento, detalle.activa && !reserva?.abordadoEn);
  const estimacion = rutaTaxi.estimacion;
  const ubicacionCliente = useUbicacionClienteMapa(Boolean(reserva && detalle.activa && !reserva.abordadoEn));
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
    if (!detalle.activa || reserva?.abordadoEn) {
      return null;
    }

    const paradero = seguimiento?.paraderoCercano ?? null;
    const punto = seguimiento?.punto ?? null;
    const destinoRuta = paradero ?? punto;
    const paraderoDistinto =
      paradero !== null &&
      (punto === null || distanciaEntre(paradero.coordenadas, punto.coordenadas) > METROS_MISMO_PUNTO);
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
                ? `El taxi está llegando a ${destinoRuta?.nombre ?? "tu punto de abordaje"}`
                : `El taxi pasará por ${destinoRuta?.nombre ?? "tu punto de abordaje"}`}
            </AppText>
            <View style={styles.datos}>
              <Dato valor={formatearHora(estimacion.llegada)} etiqueta="Hora estimada" />
              <Dato
                valor={formatearMinutos(estimacion.minutosRestantes)}
                etiqueta="Tiempo estimado"
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
            {seguimiento?.enServicio && seguimiento.taxi && destinoRuta
              ? rutaTaxi.error ?? "Calculando distancia y tiempo por calles…"
              : textoSinEstimacion(seguimiento, detalle.errorSeguimiento)}
          </AppText>
        )}

        {paradero && paraderoDistinto && (
          <View style={styles.paradero}>
            <Icono nombre="business" tamanio={20} color={Colors.brandDeep} />
            <View style={styles.detalleTexto}>
              <AppText weight="medium" style={styles.detalleValor}>Paradero cercano: {paradero.nombre}</AppText>
              <AppText style={styles.detalleEtiqueta}>
                {[
                  punto && `A ${formatearDistancia(distanciaEntre(paradero.coordenadas, punto.coordenadas))} en línea recta de tu punto`,
                ].filter(Boolean).join(" · ")}
              </AppText>
            </View>
          </View>
        )}

        <MapaReserva
          style={styles.mapa}
          cliente={ubicacionCliente.coordenadas ? { coordenadas: ubicacionCliente.coordenadas, titulo: "Tu ubicación actual" } : null}
          ruta={rutaTaxi.ruta}
          taxi={seguimiento?.taxi ? {
            coordenadas: seguimiento.taxi,
            titulo: reserva?.matricula ? `Taxi ${reserva.matricula}` : "Taxi",
          } : null}
          punto={punto && (!paradero || paraderoDistinto) ? { coordenadas: punto.coordenadas, titulo: punto.nombre } : null}
          paradero={paradero
            ? { coordenadas: paradero.coordenadas, titulo: paradero.nombre }
            : null}
        >
        {ubicacionCliente.error && <View style={styles.avisoMapa} accessibilityLiveRegion="polite">
          <Icono nombre="locationOn" tamanio={22} color={Colors.primary} />
          <View style={styles.avisoContenido}>
            <AppText weight="semibold" style={styles.avisoTitulo}>Tu ubicación no está disponible</AppText>
            <AppText style={styles.avisoTexto}>{ubicacionCliente.error} El seguimiento del taxi continúa disponible.</AppText>
          </View>
        </View>}
        <View style={[styles.avisoMapa, rutaTaxi.error && styles.avisoMapaError]} accessibilityLiveRegion="polite">
          {rutaTaxi.cargando && !rutaTaxi.error
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Icono nombre={rutaTaxi.error ? "info" : rutaTaxi.ruta ? "route" : "locationOn"} tamanio={22} color={rutaTaxi.error ? Colors.error : Colors.primary} />}
          <View style={styles.avisoContenido}>
          <AppText weight="semibold" style={styles.avisoTitulo}>
            {rutaTaxi.error ? "No pudimos actualizar la ruta" : rutaTaxi.cargando ? "Actualizando tu recorrido" : rutaTaxi.ruta ? paradero ? "Ruta al paradero" : "Ruta al punto de abordaje" : "Esperando ubicación del taxi"}
          </AppText>
        <AppText style={styles.avisoTexto}>
          {rutaTaxi.error
            ? `${rutaTaxi.error}${rutaTaxi.ruta ? " Se conservan el último trazo y la última estimación; pueden estar desactualizados." : ""}`
            : rutaTaxi.cargando
              ? "Actualizando el trazo del taxi…"
              : rutaTaxi.ruta
                ? `Trayecto sugerido en auto hacia ${destinoRuta?.nombre ?? "tu punto de abordaje"}. Se actualiza al avanzar; puede diferir del camino que tome el taxista.`
                : "El trazo aparecerá cuando el taxi comparta una ubicación reciente y haya un punto de llegada disponible."}
        </AppText>
          </View>
        </View>
        {(estimacion || (seguimiento?.ubicacionActualizadaEn && seguimiento.taxi)) ? <View style={styles.actualizacionMapa}>
          <Icono nombre="schedule" tamanio={16} color={Colors.onSurfaceVariant} />
          <View style={styles.avisoContenido}>
        {seguimiento?.ubicacionActualizadaEn && seguimiento.taxi && (
          <AppText style={styles.avisoTexto}>
            Ubicación del taxi actualizada {formatearAntiguedad(seguimiento.ubicacionActualizadaEn, ahora)}.
          </AppText>
        )}
        {estimacion && <AppText style={styles.avisoTexto}>
          Distancia y duración estimadas por calles. Cálculo actualizado {formatearAntiguedad(estimacion.calculadaEn, ahora)}.
        </AppText>}
          </View>
        </View> : null}
        </MapaReserva>
      </Card>
    );
  };

  const renderContenido = () => {
    if (detalle.cargando && !reserva) {
      return (
        <View style={styles.estadoLista}>
          <AnimacionEstado />
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
            {reserva.abordadoEn && reserva.estado === "aceptada" ? "Tu taxista confirmó que ya subiste al taxi. ¡Buen viaje!" : oferta ? "El taxista respondió a tu solicitud. Revisa su oferta." : estado.descripcion}
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

        <Card style={styles.tarjetaDetalles}>
          <View style={styles.encabezadoDetalles}>
            <AppText weight="bold" style={styles.tituloDetalles}>Detalles del viaje</AppText>
            <AppText style={styles.subtituloDetalles}>Toda la información de tu reservación</AppText>
          </View>
          {reserva.abordadoEn && <DetalleFila icono="localTaxi" etiqueta="Abordaje confirmado" valor={formatearFecha(reserva.abordadoEn)} />}
          <View style={styles.trayectoDetalles}>
            <AppText weight="semibold" style={styles.grupoTitulo}>Tu trayecto</AppText>
          <DetalleFila icono="locationHistory" etiqueta="Origen" valor={reserva.origen ?? "Mi ubicación"} />
          <DetalleFila icono="locationOn" etiqueta="Destino" valor={reserva.destino ?? "Paradero no disponible"} />
          </View>
          <View style={styles.grupoDetalles}>
            <AppText weight="semibold" style={styles.grupoTitulo}>Tu reservación</AppText>
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
          </View>
          <View style={styles.grupoDetalles}>
            <AppText weight="semibold" style={styles.grupoTitulo}>Taxi y conductor</AppText>
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
                style={({ pressed }) => [styles.contactoTaxista, pressed && styles.contactoPresionado]}
              >
                <DetalleFila
                  icono="phone"
                  etiqueta="Taxista"
                  valor={`${reserva.nombreTaxista} · ${reserva.telefonoTaxista}`}
                />
                <View style={styles.accionLlamar}>
                  <Icono nombre="phone" tamanio={16} color={Colors.primary} />
                  <AppText weight="semibold" style={styles.textoLlamar}>Llamar al taxista</AppText>
                </View>
              </Pressable>
            ) : (
              <DetalleFila icono="person" etiqueta="Taxista" valor={reserva.nombreTaxista} />
            )
          )}
          </View>
          {precio && <View style={styles.totalDetalles}>
            <View style={styles.totalEtiqueta}>
              <Icono nombre="payments" tamanio={23} color={Colors.primary} />
              <AppText weight="semibold" style={styles.grupoTitulo}>Precio total</AppText>
            </View>
            <AppText weight="bold" style={styles.totalValor}>{precio}</AppText>
          </View>}
          <DetalleFila icono="schedule" etiqueta="Solicitada" valor={formatearFecha(reserva.fechaReserva)} />
          {reserva.notas && <View style={styles.notasDetalles}><DetalleFila icono="notes" etiqueta="Tus notas" valor={reserva.notas} /></View>}

          {/* Con una oferta pendiente, «No acepto» ya cancela la solicitud. */}
          {puedeCancelarse(reserva.estado) && !reserva.abordadoEn && !oferta && (
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
    marginLeft: 10,
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
  avisoMapa: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, marginTop: 12, borderRadius: 16, backgroundColor: Colors.primaryContainer },
  avisoMapaError: { backgroundColor: Colors.errorContainerSoft },
  avisoContenido: { flex: 1, gap: 4 },
  avisoTitulo: { fontSize: 13, color: Colors.brandDeep },
  avisoTexto: { fontSize: 12, lineHeight: 18, color: Colors.onSurfaceVariant },
  actualizacionMapa: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 6, paddingTop: 10 },
  detalleFila: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    alignItems: "flex-start",
  },
  detalleIcono: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.brandSoft },
  tarjetaDetalles: { padding: 16, gap: 8 },
  encabezadoDetalles: { gap: 4, paddingBottom: 8 },
  tituloDetalles: { fontSize: 19, color: Colors.brandDeep },
  subtituloDetalles: { fontSize: 12, lineHeight: 18, color: Colors.onSurfaceVariant },
  grupoTitulo: { fontSize: 13, color: Colors.brandDeep },
  trayectoDetalles: { padding: 12, borderRadius: 16, backgroundColor: Colors.surfaceMuted },
  grupoDetalles: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  contactoTaxista: { paddingHorizontal: 10, paddingBottom: 10, borderRadius: 14, backgroundColor: Colors.primaryContainer },
  contactoPresionado: { opacity: 0.65 },
  accionLlamar: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 50, minHeight: 28 },
  textoLlamar: { fontSize: 13, color: Colors.primary },
  totalDetalles: { padding: 16, borderRadius: 16, backgroundColor: Colors.primaryContainer, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  totalEtiqueta: { flexDirection: "row", alignItems: "center", gap: 8 },
  totalValor: { fontSize: 26, color: Colors.brandDeep, flexShrink: 1 },
  notasDetalles: { paddingHorizontal: 10, borderRadius: 14, backgroundColor: Colors.surfaceSoft },
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
