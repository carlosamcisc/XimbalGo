import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import TextInputField from "../../components/TextInputField";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import { Icono } from "../../components/Icono";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";
import {
  cambiarContrasena,
  iniciarSesion,
} from "../../infrastructure/supabase/auth/auth.service";
import { mensajeError } from "./useClienteInicio";
import { useCliente } from "./ClienteContext";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteSeguridad">;

// Coincide con `minimum_password_length` de Supabase Auth.
const LONGITUD_MINIMA = 6;

const ClienteSeguridadScreen = ({ navigation }: Props) => {
  const { perfil } = useCliente();
  const correo = perfil?.correo ?? "";
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const validar = (): string | null => {
    if (!actual || !nueva || !confirmacion) {
      return "Completa todos los campos.";
    }
    if (nueva.length < LONGITUD_MINIMA) {
      return `La nueva contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`;
    }
    if (nueva !== confirmacion) {
      return "Las contraseñas nuevas no coinciden.";
    }
    if (nueva === actual) {
      return "La nueva contraseña debe ser distinta de la actual.";
    }
    if (!correo) {
      return "No se encontró el correo de tu cuenta.";
    }
    return null;
  };

  const guardar = async () => {
    const error = validar();
    if (error) {
      ToastMessage.show(error, "long");
      return;
    }

    setGuardando(true);
    try {
      // Supabase no pide la contraseña actual: se comprueba iniciando sesión.
      try {
        await iniciarSesion(correo, actual);
      } catch {
        throw new Error("La contraseña actual no es correcta.");
      }
      await cambiarContrasena(nueva);
      setActual("");
      setNueva("");
      setConfirmacion("");
      ToastMessage.show("Contraseña actualizada");
      navigation.goBack();
    } catch (e: unknown) {
      ToastMessage.show(mensajeError(e, "No se pudo cambiar la contraseña."), "long");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla titulo="Seguridad" subtitulo="Protege el acceso a tu cuenta" onBack={() => navigation.goBack()} />
      <View style={styles.pantalla}>
        <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
          <Card style={styles.tarjeta}>
            <View style={styles.aviso}>
              <Icono nombre="lock" tamanio={22} color={Colors.primary} />
              <AppText style={styles.textoAviso}>
                Usa una contraseña que no utilices en otros servicios.
              </AppText>
            </View>
            <TextInputField label="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry autoCapitalize="none" icono="lock" />
            <TextInputField
              label="Nueva contraseña"
              value={nueva}
              placeholder={`Mínimo ${LONGITUD_MINIMA} caracteres`}
              onChangeText={setNueva}
              secureTextEntry
              autoCapitalize="none"
              icono="lock"
            />
            <TextInputField label="Confirma la nueva contraseña" value={confirmacion} onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" icono="lock" />
            <Button
              titulo={guardando ? "Guardando..." : "Cambiar contraseña"}
              disabled={guardando}
              onPress={() => void guardar()}
            />
          </Card>

          <Card style={styles.tarjeta}>
            <AppText weight="semibold" style={styles.tituloTarjeta}>¿Olvidaste tu contraseña?</AppText>
            <AppText style={styles.descripcion}>
              Cierra sesión desde el menú y en la pantalla de inicio de sesión elige
              «¿Olvidaste tu contraseña?». Te enviaremos un enlace a {correo || "tu correo"}.
            </AppText>
          </Card>
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
  tarjeta: {
    padding: 14,
  },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.primaryContainer,
  },
  textoAviso: {
    flex: 1,
    fontSize: 13,
    color: Colors.onPrimaryContainer,
  },
  tituloTarjeta: {
    fontSize: 17,
    color: Colors.brandText,
    marginHorizontal: 10,
  },
  descripcion: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 6,
  },
});

export default ClienteSeguridadScreen;
