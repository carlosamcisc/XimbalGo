import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import FotoParadero from "../../components/FotoParadero";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import { abrirEnMapa } from "../../infrastructure/location/location.service";
import { formatearTrayectoParadero, type Coordenadas } from "../../modules/cliente/ubicacion";
import { useClienteParadero } from "./useClienteParaderos";
import { mensajeError } from "./useClienteInicio";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteParadero">;

const formatearCoordenadas = ({ latitud, longitud }: Coordenadas) =>
  `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;

interface FilaProps {
  icono: NombreIcono;
  etiqueta: string;
  valor: string;
  detalle?: string | null;
}

const Fila = ({ icono, etiqueta, valor, detalle }: FilaProps) => (
  <View style={styles.fila}>
    <View style={styles.iconoFila}>
      <Icono nombre={icono} tamanio={20} color={Colors.primary} />
    </View>
    <View style={styles.textoFila}>
      <AppText style={styles.etiqueta}>{etiqueta}</AppText>
      <AppText weight="semibold" style={styles.valor}>{valor}</AppText>
      {detalle && <AppText style={styles.detalle}>{detalle}</AppText>}
    </View>
  </View>
);

const ClienteParaderoScreen = ({ navigation, route }: Props) => {
  const {
    paraderoId,
    distanciaMetros,
    segundosCaminando = null,
    distanciaMotoMetros = null,
    segundosMoto = null,
  } = route.params;
  const { paradero, direccion, cargando, refrescando, error, cargar, refrescar } =
    useClienteParadero(paraderoId);

  const verEnMapa = async () => {
    if (!paradero?.coordenadas) {
      return;
    }
    try {
      await abrirEnMapa(paradero.coordenadas, paradero.nombre);
    } catch (causa: unknown) {
      ToastMessage.show(mensajeError(causa, "No se pudo abrir el mapa."), "long");
    }
  };

  const seleccionarComoOrigen = () => {
    if (!paradero) {
      return;
    }
    navigation.popTo("ClienteInicio", {
      paraderoOrigen: {
        id: paradero.id,
        nombre: paradero.nombre,
        referencia: paradero.referencia,
      },
    });
  };

  const renderContenido = () => {
    if (cargando && !paradero) {
      return (
        <View style={styles.estado}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando paradero...</AppText>
        </View>
      );
    }
    if (!paradero) {
      return (
        <Card>
          <View style={styles.estado}>
            <AppText style={styles.textoEstado}>{error ?? "No se pudo cargar el paradero."}</AppText>
            <Pressable onPress={() => void cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }

    const { coordenadas } = paradero;
    const distancia = distanciaMetros !== undefined
      ? `A ${formatearTrayectoParadero({
          distanciaMetros,
          segundosCaminando,
          distanciaMotoMetros,
          segundosMoto,
        })} de ti`
      : null;

    return (
      <>
        <FotoParadero
          url={paradero.fotoUrl}
          style={styles.foto}
          tamanioIcono={56}
          accessibilityLabel={`Foto de ${paradero.nombre}`}
        />
        <Card>
          <Fila icono="business" etiqueta="Nombre" valor={paradero.nombre} />
          <View style={styles.divisor} />
          <Fila
            icono="locationOn"
            etiqueta="Ubicación"
            valor={
              coordenadas
                ? direccion ?? formatearCoordenadas(coordenadas)
                : "Ubicación no registrada"
            }
            detalle={[
              coordenadas && direccion ? formatearCoordenadas(coordenadas) : null,
              distancia,
            ].filter(Boolean).join(" · ") || null}
          />
          <View style={styles.divisor} />
          <Fila
            icono="info"
            etiqueta="Referencia para llegar"
            valor={paradero.referencia?.trim() || "Sin referencia registrada"}
          />
        </Card>
        <View style={styles.acciones}>
          <Button
            titulo="Ver en el mapa"
            color={Colors.brandDeep}
            borderColor={Colors.brandDeep}
            disabled={!coordenadas}
            onPress={() => void verEnMapa()}
          />
          <Button titulo="Seleccionar como origen" onPress={seleccionarComoOrigen} />
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla
        titulo={paradero?.nombre ?? "Paradero"}
        subtitulo="Información del paradero"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.pantalla}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void refrescar()}
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  foto: {
    height: 200,
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 22,
  },
  fila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 8,
  },
  iconoFila: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
  },
  textoFila: {
    flex: 1,
  },
  etiqueta: {
    fontSize: 12,
    color: Colors.outline,
  },
  valor: {
    fontSize: 15,
    color: Colors.brandText,
    marginTop: 2,
  },
  detalle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  divisor: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 58,
  },
  acciones: {
    marginHorizontal: 12,
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

export default ClienteParaderoScreen;
