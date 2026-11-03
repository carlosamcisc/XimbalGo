import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, ToastAndroid } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import Colors from "../theme/colors";
import AppText from "./AppText";

type Duracion = "short" | "long";

// Lo mismo que duran ToastAndroid.SHORT y ToastAndroid.LONG.
const DURACION_MS: Record<Duracion, number> = { short: 2000, long: 3500 };
const ANIMACION_MS = 200;

interface Aviso {
  id: number;
  mensaje: string;
  duracion: Duracion;
}

// iOS no tiene toast nativo: `ToastHost` dibuja los avisos que llegan aquí.
let siguienteId = 0;
let alMostrar: ((aviso: Aviso) => void) | null = null;

export const ToastMessage = {
  show: (mensaje: string, duracion: Duracion = "short") => {
    if (Platform.OS === "android") {
      ToastAndroid.show(
        mensaje,
        duracion === "short" ? ToastAndroid.SHORT : ToastAndroid.LONG
      );
      return;
    }
    alMostrar?.({ id: ++siguienteId, mensaje, duracion });
    AccessibilityInfo.announceForAccessibility(mensaje);
  },
};

/**
 * Muestra los toasts en iOS. Va una sola vez en la raíz de la app; en
 * Android no dibuja nada. Usa `FullWindowOverlay` para quedar encima de
 * los `Modal`, que en iOS tapan todo lo que está en la raíz.
 */
export function ToastHost() {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const opacidad = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === "android") {
      return;
    }
    alMostrar = setAviso;
    return () => {
      alMostrar = null;
    };
  }, []);

  // Un aviso nuevo reemplaza al que se esté mostrando.
  useEffect(() => {
    if (!aviso) {
      return;
    }
    opacidad.setValue(0);
    Animated.timing(opacidad, { toValue: 1, duration: ANIMACION_MS, useNativeDriver: true }).start();
    const temporizador = setTimeout(() => {
      Animated.timing(opacidad, { toValue: 0, duration: ANIMACION_MS, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) {
            setAviso((actual) => (actual?.id === aviso.id ? null : actual));
          }
        }
      );
    }, DURACION_MS[aviso.duracion]);
    return () => clearTimeout(temporizador);
  }, [aviso, opacidad]);

  if (!aviso) {
    return null;
  }

  return (
    <FullWindowOverlay>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            bottom: insets.bottom + 64,
            opacity: opacidad,
            transform: [
              { translateY: opacidad.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
      >
        <AppText style={styles.texto}>{aviso.mensaje}</AppText>
      </Animated.View>
    </FullWindowOverlay>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "86%",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "rgba(32,32,32,0.92)",
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  texto: {
    color: Colors.white,
    fontSize: 14,
    textAlign: "center",
  },
});
