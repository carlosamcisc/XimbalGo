import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import SelectorAsientos from "../../components/SelectorAsientos";
import SelectorFechaViaje from "../../components/SelectorFechaViaje";
import TaxiCard from "../../components/TaxiCard";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import {
  MAXIMO_ASIENTOS_RESERVA,
  etiquetaOrigen,
  formatearFecha,
  formatearPrecio,
  textoAsientos,
} from "../../modules/cliente/reservas";
import { formatearDistancia } from "../../modules/cliente/ubicacion";
import { useClienteReservar } from "./useClienteReservar";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteReservar">;

const MAXIMO_NOTAS = 200;

const Fila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
  <View style={styles.fila}>
    <Icono nombre={icono} tamanio={20} color={Colors.primary} />
    <View style={styles.textoFila}>
      <AppText style={styles.etiquetaFila}>{etiqueta}</AppText>
      <AppText weight="medium" style={styles.valorFila}>{valor}</AppText>
    </View>
  </View>
);

const Seccion = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <Card>
    <AppText weight="semibold" style={styles.tituloSeccion}>{titulo}</AppText>
    {children}
  </Card>
);

const ClienteReservarScreen = ({ navigation, route }: Props) => {
  const { vehiculoId, origen, destino, distanciaMetros } = route.params;
  const reservar = useClienteReservar(vehiculoId);
  const { taxi } = reservar;
  const [cantidad, setCantidad] = useState(1);
  const [fechaViaje, setFechaViaje] = useState<Date | null>(null);
  const [notas, setNotas] = useState("");

  const maximo = Math.min(taxi?.asientosDisponibles ?? 0, MAXIMO_ASIENTOS_RESERVA);
  // Si otro cliente toma asientos, la cantidad elegida no puede pasar de los libres.
  useEffect(() => {
    if (maximo > 0 && cantidad > maximo) {
      setCantidad(maximo);
    }
  }, [maximo, cantidad]);

  const total = taxi?.precio !== null && taxi?.precio !== undefined ? taxi.precio * cantidad : null;
  const sinAsientos = taxi !== null && taxi.asientosDisponibles === 0;
  const puedeReservar = taxi !== null && taxi.enServicio && !sinAsientos && !reservar.reservando;

  const confirmar = async () => {
    if (!taxi) {
      return;
    }
    if (fechaViaje && fechaViaje.getTime() < Date.now()) {
      ToastMessage.show("La hora elegida ya pasó. Elige otra.");
      setFechaViaje(null);
      return;
    }
    try {
      const reservaId = await reservar.reservar({
        origen,
        destino,
        cantidadAsientos: cantidad,
        fechaViaje,
        notas,
      });
      ToastMessage.show("Reservación enviada al taxista");
      navigation.replace("ClienteReserva", { reservaId });
    } catch (e: unknown) {
      ToastMessage.show(e instanceof Error ? e.message : "No se pudo crear la reservación.", "long");
    }
  };

  const renderContenido = () => {
    if (reservar.cargando && !taxi) {
      return (
        <View style={styles.estado}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando taxi...</AppText>
        </View>
      );
    }
    if (!taxi) {
      return (
        <Card>
          <View style={styles.estado}>
            <AppText style={styles.textoEstado}>{reservar.error ?? "No se pudo cargar el taxi."}</AppText>
            <Pressable onPress={() => void reservar.cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }

    const precioUnitario = formatearPrecio(taxi.precio);
    const precioTotal = formatearPrecio(total);

    return (
      <>
        <Seccion titulo="Tu viaje">
          <Fila icono="locationHistory" etiqueta="Origen" valor={etiquetaOrigen(origen)} />
          <Fila icono="locationOn" etiqueta="Destino" valor={destino} />
          <TaxiCard
            nombre={`${taxi.matricula} · ${taxi.nombreTaxista}`}
            distancia={distanciaMetros !== undefined ? formatearDistancia(distanciaMetros) : undefined}
            asientos={taxi.asientosDisponibles}
            lleno={sinAsientos}
          />
          {[taxi.vehiculo, taxi.ruta].some(Boolean) && (
            <AppText style={styles.textoAyuda}>
              {[taxi.vehiculo, taxi.ruta && `Ruta ${taxi.ruta}`].filter(Boolean).join(" · ")}
            </AppText>
          )}
        </Seccion>

        <Seccion titulo="¿Cuántos asientos?">
          {sinAsientos ? (
            <AppText style={styles.textoAviso}>
              Este taxi se acaba de llenar. Elige otro taxi.
            </AppText>
          ) : (
            <>
              <SelectorAsientos
                cantidad={cantidad}
                maximo={maximo}
                onCambiar={setCantidad}
                disabled={reservar.reservando}
              />
              <AppText style={styles.textoAyuda}>
                {`${textoAsientos(taxi.asientosDisponibles)} libres de ${taxi.totalAsientos}. Se actualiza en tiempo real.`}
              </AppText>
            </>
          )}
        </Seccion>

        <Seccion titulo="¿Cuándo viajas?">
          <SelectorFechaViaje fecha={fechaViaje} onCambiar={setFechaViaje} disabled={reservar.reservando} />
        </Seccion>

        <Seccion titulo="Notas para el taxista (opcional)">
          <TextInput
            style={styles.notas}
            value={notas}
            onChangeText={setNotas}
            placeholder="Ej. Llevo una maleta, espero frente a la tienda"
            placeholderTextColor={Colors.outline}
            maxLength={MAXIMO_NOTAS}
            multiline
            editable={!reservar.reservando}
            accessibilityLabel="Notas para el taxista"
          />
        </Seccion>

        <Seccion titulo="Resumen">
          <Fila icono="eventSeat" etiqueta="Asientos" valor={textoAsientos(cantidad)} />
          <Fila
            icono="schedule"
            etiqueta="Fecha y hora"
            valor={fechaViaje ? formatearFecha(fechaViaje.toISOString()) : "Lo antes posible"}
          />
          {precioTotal && (
            <Fila
              icono="payments"
              etiqueta={cantidad > 1 ? `Total (${precioUnitario} por asiento)` : "Precio"}
              valor={precioTotal}
            />
          )}
          {!taxi.enServicio && (
            <AppText style={styles.textoAviso}>
              El taxista dejó de estar en servicio. Elige otro taxi.
            </AppText>
          )}
          <Button
            titulo={reservar.reservando ? "Reservando..." : `Reservar ${textoAsientos(cantidad)}`}
            disabled={!puedeReservar}
            onPress={() => void confirmar()}
          />
          <AppText style={styles.textoAyuda}>
            Apartaremos tus asientos y el taxista recibirá tu solicitud.
          </AppText>
        </Seccion>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo="Reservar asientos"
        subtitulo="Elige cuántos asientos y cuándo viajas"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.pantalla}>
        <KeyboardAwareScroll
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={reservar.refrescando}
              onRefresh={() => void reservar.refrescar()}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {renderContenido()}
        </KeyboardAwareScroll>
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
  tituloSeccion: {
    fontSize: 16,
    color: Colors.brandDeep,
    marginBottom: 6,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  textoFila: {
    flex: 1,
  },
  etiquetaFila: {
    fontSize: 12,
    color: Colors.outline,
  },
  valorFila: {
    fontSize: 14,
    color: Colors.brandText,
  },
  textoAyuda: {
    fontSize: 13,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  textoAviso: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.error,
    marginVertical: 8,
  },
  notas: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    textAlignVertical: "top",
  },
  estado: {
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
});

export default ClienteReservarScreen;
