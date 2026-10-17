import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import { BotonEncabezado } from "../../components/EncabezadoPantalla";
import { Icono } from "../../components/Icono";
import { SideBar, SideBarEncabezado, type SideBarOpcion } from "../../components/SideBar";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import { cerrarSesionUsuario } from "../../store/autenticacionStore";
import { mensajeError } from "./useClienteInicio";
import { useCliente } from "./ClienteContext";

type OpcionMenu =
  | "perfil"
  | "reservaciones"
  | "notificaciones"
  | "seguridad"
  | "ayuda"
  | "cerrarSesion";

// Pantallas que se abren sin parámetros obligatorios.
type PantallaMenu = Exclude<keyof ClienteStackParamList, "ClienteParadero">;

const PANTALLA_OPCION: Record<Exclude<OpcionMenu, "cerrarSesion">, PantallaMenu> = {
  perfil: "ClientePerfil",
  reservaciones: "ClienteReservaciones",
  notificaciones: "ClienteNotificaciones",
  seguridad: "ClienteSeguridad",
  ayuda: "ClienteAyuda",
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

const Estadistica = ({ valor, etiqueta }: { valor: number; etiqueta: string }) => (
  <View style={styles.estadistica}>
    <AppText weight="bold" style={styles.valorEstadistica}>{valor}</AppText>
    <AppText style={styles.etiquetaEstadistica}>{etiqueta}</AppText>
  </View>
);

/** Botón de encabezado que abre el menú, con aviso de notificaciones sin leer. */
export function BotonMenuCliente({ onPress }: { onPress: () => void }) {
  const { noLeidas } = useCliente();
  return (
    <BotonEncabezado
      onPress={onPress}
      accessibilityLabel={noLeidas > 0 ? `Abrir menú, ${noLeidas} notificaciones sin leer` : "Abrir menú"}
    >
      <Icono nombre="menu" tamanio={24} color={Colors.white} />
      {noLeidas > 0 && <View style={styles.indicador} />}
    </BotonEncabezado>
  );
}

/** Menú lateral del cliente con sus datos y accesos a su cuenta. */
export default function ClienteSideBar({ visible, onClose }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<ClienteStackParamList>>();
  const cliente = useCliente();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const opciones: SideBarOpcion<OpcionMenu>[] = [
    { id: "perfil", label: "Mi perfil", icono: "person", descripcion: "Tus datos personales" },
    {
      id: "reservaciones",
      label: "Mis reservaciones",
      icono: "bookMarks",
      descripcion: cliente.resumen.enCurso > 0 ? `${cliente.resumen.enCurso} en curso` : "Viajes e historial",
    },
    {
      id: "notificaciones",
      label: "Notificaciones",
      icono: "notifications",
      descripcion: "Respuestas de los taxistas",
      contador: cliente.noLeidas,
    },
    { id: "seguridad", label: "Seguridad", icono: "lockReset", descripcion: "Cambia tu contraseña" },
    { id: "ayuda", label: "Ayuda", icono: "help", descripcion: "Preguntas frecuentes" },
  ];

  const opcionesPie: SideBarOpcion<OpcionMenu>[] = [
    {
      id: "cerrarSesion",
      label: cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión",
      icono: "logout",
      peligro: true,
      disabled: cerrandoSesion,
    },
  ];

  const cerrarSesion = async () => {
    setCerrandoSesion(true);
    try {
      await cerrarSesionUsuario();
    } catch (e: unknown) {
      setCerrandoSesion(false);
      ToastMessage.show(mensajeError(e, "No se pudo cerrar la sesión."), "long");
    }
  };

  const seleccionar = (opcion: OpcionMenu) => {
    if (opcion === "cerrarSesion") {
      Alert.alert("Cerrar sesión", "¿Quieres cerrar tu sesión?", [
        { text: "Volver", style: "cancel" },
        { text: "Cerrar sesión", style: "destructive", onPress: () => void cerrarSesion() },
      ]);
      return;
    }
    onClose();
    navigation.navigate(PANTALLA_OPCION[opcion]);
  };

  const { perfil } = cliente;

  return (
    <SideBar
      visible={visible}
      onClose={onClose}
      opciones={opciones}
      opcionesPie={opcionesPie}
      onSelect={seleccionar}
      nota="XimbalGo · Cliente"
      encabezado={
        <SideBarEncabezado
          titulo={cliente.cargando && !perfil ? "Cargando..." : cliente.nombreCompleto}
          subtitulo={perfil?.correo || perfil?.telefono || undefined}
          inicial={cliente.inicial}
          fotoUrl={perfil?.fotoUrl}
          etiqueta="Cliente"
          onPress={() => seleccionar("perfil")}
        >
          <View style={styles.estadisticas}>
            <Estadistica valor={cliente.resumen.completados} etiqueta="Viajes" />
            <View style={styles.separador} />
            <Estadistica valor={cliente.resumen.enCurso} etiqueta="En curso" />
            <View style={styles.separador} />
            <Estadistica valor={cliente.resumen.total} etiqueta="Reservas" />
          </View>
        </SideBarEncabezado>
      }
    />
  );
}

const styles = StyleSheet.create({
  estadisticas: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  estadistica: {
    flex: 1,
    alignItems: "center",
  },
  valorEstadistica: {
    fontSize: 18,
    color: Colors.white,
  },
  etiquetaEstadistica: {
    fontSize: 11,
    color: Colors.brandSubtitle,
  },
  indicador: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.danger,
  },
  separador: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});
