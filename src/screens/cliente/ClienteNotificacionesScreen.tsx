import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Card from "../../components/Card";
import EncabezadoPantalla, { BotonEncabezado } from "../../components/EncabezadoPantalla";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import { formatearFecha } from "../../modules/cliente/reservas";
import type { NotificacionCliente, TipoNotificacion } from "../../modules/cliente/types";
import { useCliente } from "./ClienteContext";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteNotificaciones">;

const PRESENTACION_TIPO: Record<TipoNotificacion, { icono: NombreIcono; color: string; fondo: string }> = {
  reserva_solicitada: { icono: "bookMarks", color: Colors.primary, fondo: Colors.primaryContainer },
  reserva_aceptada: { icono: "checkCircle", color: Colors.success, fondo: Colors.brandAccentContainer },
  reserva_rechazada: { icono: "cancel", color: Colors.error, fondo: Colors.errorContainerSoft },
  reserva_cancelada: { icono: "cancel", color: Colors.error, fondo: Colors.errorContainerSoft },
  van_llegando: { icono: "localTaxi", color: Colors.primary, fondo: Colors.primaryContainer },
  viaje_completado: { icono: "doneAll", color: Colors.brandAccentBright, fondo: Colors.brandAccentContainer },
};

const ClienteNotificacionesScreen = ({ navigation }: Props) => {
  const cliente = useCliente();

  const marcar = async (notificacionId?: string) => {
    const error = await cliente.marcarLeidas(notificacionId);
    if (error) {
      ToastMessage.show(error, "long");
    }
  };

  const abrir = (notificacion: NotificacionCliente) => {
    if (!notificacion.leida) {
      void marcar(notificacion.id);
    }
    if (notificacion.reservaId) {
      navigation.navigate("ClienteReservaciones");
    }
  };

  const renderContenido = () => {
    if (cliente.cargando && cliente.notificaciones.length === 0) {
      return (
        <View style={styles.estadoLista}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando notificaciones...</AppText>
        </View>
      );
    }
    if (cliente.error && cliente.notificaciones.length === 0) {
      return (
        <Card>
          <View style={styles.estadoLista}>
            <AppText style={styles.textoEstado}>{cliente.error}</AppText>
            <Pressable onPress={() => void cliente.cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }
    if (cliente.notificaciones.length === 0) {
      return (
        <Card>
          <View style={styles.estadoLista}>
            <Icono nombre="notifications" tamanio={36} color={Colors.outlineVariant} />
            <AppText style={styles.textoEstado}>
              No tienes notificaciones. Aquí verás cuando un taxista acepte o rechace tus reservaciones.
            </AppText>
          </View>
        </Card>
      );
    }

    return cliente.notificaciones.map((notificacion) => {
      const presentacion = PRESENTACION_TIPO[notificacion.tipo] ?? PRESENTACION_TIPO.reserva_solicitada;
      return (
        <Pressable
          key={notificacion.id}
          onPress={() => abrir(notificacion)}
          accessibilityRole="button"
          accessibilityLabel={`${notificacion.leida ? "" : "Nueva. "}${notificacion.titulo}. ${notificacion.mensaje}`}
          style={({ pressed }) => [
            styles.notificacion,
            !notificacion.leida && styles.noLeida,
            pressed && styles.presionada,
          ]}
        >
          <View style={[styles.iconoTipo, { backgroundColor: presentacion.fondo }]}>
            <Icono nombre={presentacion.icono} tamanio={22} color={presentacion.color} />
          </View>
          <View style={styles.textoNotificacion}>
            <View style={styles.filaTitulo}>
              <AppText weight={notificacion.leida ? "medium" : "semibold"} style={styles.titulo} numberOfLines={1}>
                {notificacion.titulo}
              </AppText>
              {!notificacion.leida && <View style={styles.punto} />}
            </View>
            <AppText style={styles.mensaje}>{notificacion.mensaje}</AppText>
            <AppText style={styles.fecha}>{formatearFecha(notificacion.fecha)}</AppText>
          </View>
        </Pressable>
      );
    });
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo="Notificaciones"
        subtitulo={cliente.noLeidas > 0 ? `${cliente.noLeidas} sin leer` : "Estás al día"}
        onBack={() => navigation.goBack()}
        accion={
          cliente.noLeidas > 0 ? (
            <BotonEncabezado onPress={() => void marcar()} accessibilityLabel="Marcar todas como leídas">
              <Icono nombre="doneAll" tamanio={22} color={Colors.white} />
            </BotonEncabezado>
          ) : undefined
        }
      />
      <View style={styles.pantalla}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={cliente.refrescando}
              onRefresh={() => void cliente.refrescar()}
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  notificacion: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.white,
  },
  noLeida: {
    borderColor: Colors.primaryFixedDim,
    backgroundColor: Colors.surfaceBright,
  },
  presionada: {
    backgroundColor: Colors.primaryContainer,
  },
  iconoTipo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  textoNotificacion: {
    flex: 1,
  },
  filaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titulo: {
    flex: 1,
    fontSize: 15,
    color: Colors.brandText,
  },
  punto: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  mensaje: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  fecha: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 6,
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
});

export default ClienteNotificacionesScreen;
