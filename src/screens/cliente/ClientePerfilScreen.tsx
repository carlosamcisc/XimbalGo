import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import TextInputField from "../../components/TextInputField";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import { Icono, type NombreIcono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import type { DatosPerfilCliente, PerfilCliente } from "../../modules/cliente/types";
import { useCliente } from "./ClienteContext";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClientePerfil">;

interface Formulario {
  nombres: string;
  apellidos: string;
  telefono: string;
  edad: string;
  direccion: string;
}

const EDAD_MAXIMA = 120;

const formularioDesde = (perfil: PerfilCliente | null): Formulario => ({
  nombres: perfil?.nombres ?? "",
  apellidos: perfil?.apellidos ?? "",
  telefono: perfil?.telefono ?? "",
  edad: perfil?.edad !== null && perfil?.edad !== undefined ? String(perfil.edad) : "",
  direccion: perfil?.direccion ?? "",
});

/** Devuelve los datos listos para guardar, o un mensaje de error. */
function validar(formulario: Formulario): DatosPerfilCliente | string {
  if (!formulario.nombres.trim() || !formulario.apellidos.trim() || !formulario.telefono.trim()) {
    return "Nombre, apellidos y teléfono son obligatorios.";
  }
  if (!/^\+?[\d\s-]{7,20}$/.test(formulario.telefono.trim())) {
    return "Escribe un teléfono válido.";
  }

  const edadTexto = formulario.edad.trim();
  const edad = edadTexto ? Number(edadTexto) : null;
  if (edad !== null && (!Number.isInteger(edad) || edad < 0 || edad > EDAD_MAXIMA)) {
    return "Escribe una edad válida.";
  }

  return {
    nombres: formulario.nombres.trim(),
    apellidos: formulario.apellidos.trim(),
    telefono: formulario.telefono.trim(),
    edad,
    direccion: formulario.direccion.trim() || null,
  };
}

function formatearMiembroDesde(fechaIso: string | null): string | null {
  if (!fechaIso) {
    return null;
  }
  return new Date(fechaIso).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

const DatoFila = ({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) => (
  <View style={styles.datoFila}>
    <Icono nombre={icono} tamanio={20} color={Colors.primary} />
    <View style={styles.datoTexto}>
      <AppText style={styles.datoEtiqueta}>{etiqueta}</AppText>
      <AppText weight="medium" style={styles.datoValor}>{valor}</AppText>
    </View>
  </View>
);

const ClientePerfilScreen = ({ navigation }: Props) => {
  const cliente = useCliente();
  const { perfil, resumen } = cliente;
  const [formulario, setFormulario] = useState<Formulario>(() => formularioDesde(perfil));
  const [guardando, setGuardando] = useState(false);

  // Rellena el formulario cuando el perfil termina de cargar o se guarda.
  useEffect(() => {
    setFormulario(formularioDesde(perfil));
  }, [perfil?.nombres, perfil?.apellidos, perfil?.telefono, perfil?.edad, perfil?.direccion]);

  const cambiar = (campo: keyof Formulario) => (valor: string) =>
    setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const hayCambios = JSON.stringify(formulario) !== JSON.stringify(formularioDesde(perfil));

  const guardar = async () => {
    const datos = validar(formulario);
    if (typeof datos === "string") {
      ToastMessage.show(datos, "long");
      return;
    }
    setGuardando(true);
    const error = await cliente.guardarPerfil(datos);
    setGuardando(false);
    ToastMessage.show(error ?? "Perfil actualizado", error ? "long" : "short");
  };

  const renderContenido = () => {
    if (cliente.cargando && !perfil) {
      return (
        <View style={styles.estadoLista}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando tu perfil...</AppText>
        </View>
      );
    }
    if (!perfil) {
      return (
        <Card>
          <View style={styles.estadoLista}>
            <AppText style={styles.textoEstado}>{cliente.error ?? "No se pudo cargar tu perfil."}</AppText>
            <Pressable onPress={() => void cliente.cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }

    const miembroDesde = formatearMiembroDesde(perfil.fechaRegistro);

    return (
      <>
        <Card style={styles.tarjetaPerfil}>
          <View style={styles.avatar}>
            {perfil.fotoUrl ? (
              <Image source={{ uri: perfil.fotoUrl }} style={styles.avatarImagen} />
            ) : (
              <AppText weight="bold" style={styles.avatarLetra}>{cliente.inicial}</AppText>
            )}
          </View>
          <AppText weight="semibold" style={styles.nombre}>{cliente.nombreCompleto}</AppText>
          {miembroDesde && <AppText style={styles.miembro}>Miembro desde {miembroDesde}</AppText>}

          <View style={styles.estadisticas}>
            {[
              { valor: resumen.completados, etiqueta: "Viajes completados" },
              { valor: resumen.enCurso, etiqueta: "En curso" },
              { valor: resumen.total, etiqueta: "Reservaciones" },
            ].map((dato) => (
              <View key={dato.etiqueta} style={styles.estadistica}>
                <AppText weight="bold" style={styles.valorEstadistica}>{dato.valor}</AppText>
                <AppText style={styles.etiquetaEstadistica}>{dato.etiqueta}</AppText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.tarjeta}>
          <AppText weight="semibold" style={styles.tituloTarjeta}>Cuenta</AppText>
          <DatoFila icono="email" etiqueta="Correo electrónico" valor={perfil.correo || "No disponible"} />
          <DatoFila icono="badge" etiqueta="Tipo de cuenta" valor="Cliente" />
          <Pressable
            onPress={() => navigation.navigate("ClienteSeguridad")}
            accessibilityRole="button"
            style={styles.enlaceSeguridad}
          >
            <AppText weight="semibold" style={styles.enlace}>Cambiar contraseña</AppText>
            <Icono nombre="ArrowRight" tamanio={20} color={Colors.primary} />
          </Pressable>
        </Card>

        <Card style={styles.tarjeta}>
          <AppText weight="semibold" style={styles.tituloTarjeta}>Datos personales</AppText>
          <TextInputField label="Nombre(s) *" value={formulario.nombres} onChangeText={cambiar("nombres")} autoCapitalize="words" />
          <TextInputField label="Apellidos *" value={formulario.apellidos} onChangeText={cambiar("apellidos")} autoCapitalize="words" />
          <TextInputField
            label="Teléfono *"
            value={formulario.telefono}
            placeholder="El taxista lo verá cuando acepte tu viaje"
            onChangeText={cambiar("telefono")}
            keyboardType="phone-pad"
          />
          <TextInputField label="Edad" value={formulario.edad} onChangeText={cambiar("edad")} keyboardType="number-pad" />
          <TextInputField label="Dirección" value={formulario.direccion} onChangeText={cambiar("direccion")} autoCapitalize="sentences" />
          <Button
            titulo={guardando ? "Guardando..." : "Guardar cambios"}
            disabled={guardando || !hayCambios}
            onPress={() => void guardar()}
          />
        </Card>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla titulo="Mi perfil" subtitulo="Tus datos y tu actividad" onBack={() => navigation.goBack()} />
      <View style={styles.pantalla}>
        <KeyboardAwareScroll
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
    paddingTop: 6,
    paddingBottom: 40,
  },
  tarjetaPerfil: {
    alignItems: "center",
    padding: 18,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
    overflow: "hidden",
  },
  avatarImagen: {
    width: "100%",
    height: "100%",
  },
  avatarLetra: {
    fontSize: 36,
    color: Colors.primary,
  },
  nombre: {
    fontSize: 20,
    color: Colors.brandText,
    marginTop: 12,
    textAlign: "center",
  },
  miembro: {
    fontSize: 13,
    color: Colors.outline,
    marginTop: 2,
  },
  estadisticas: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Colors.primaryContainer,
  },
  estadistica: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  valorEstadistica: {
    fontSize: 20,
    color: Colors.primary,
  },
  etiquetaEstadistica: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
  },
  tarjeta: {
    padding: 14,
  },
  tituloTarjeta: {
    fontSize: 17,
    color: Colors.brandText,
    marginHorizontal: 10,
    marginBottom: 4,
  },
  datoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    marginHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  datoTexto: {
    flex: 1,
  },
  datoEtiqueta: {
    fontSize: 12,
    color: Colors.outline,
  },
  datoValor: {
    fontSize: 14,
    color: Colors.brandText,
  },
  enlaceSeguridad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginHorizontal: 10,
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

export default ClientePerfilScreen;
