import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono, type NombreIcono } from "./Icono";

export interface SideBarOpcion<T extends string> {
  id: T;
  label: string;
  icono: NombreIcono;
  descripcion?: string;
  /** Muestra un contador a la derecha cuando es mayor a cero. */
  contador?: number;
  /** Pinta la opción en rojo (p. ej. cerrar sesión). */
  peligro?: boolean;
  disabled?: boolean;
}

interface Props<T extends string> {
  visible: boolean;
  onClose: () => void;
  opciones: readonly SideBarOpcion<T>[];
  onSelect: (id: T) => void;
  /** Contenido superior, normalmente `SideBarEncabezado`. */
  encabezado?: ReactNode;
  /** Opciones separadas al final del panel. */
  opcionesPie?: readonly SideBarOpcion<T>[];
  /** Texto pequeño al final, p. ej. la versión de la app. */
  nota?: string;
  lado?: "izquierda" | "derecha";
}

const DURACION_MS = 240;
const ANCHO_MAXIMO = 330;

/** Panel lateral deslizable con encabezado y lista de opciones. */
export function SideBar<T extends string>({
  visible,
  onClose,
  opciones,
  onSelect,
  encabezado,
  opcionesPie = [],
  nota,
  lado = "izquierda",
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ancho = Math.min(ANCHO_MAXIMO, width * 0.84);
  const fuera = lado === "izquierda" ? -ancho : ancho;

  // El modal sigue montado mientras corre la animación de cierre.
  const [montado, setMontado] = useState(visible);
  const progreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMontado(true);
    }
    const animacion = Animated.timing(progreso, {
      toValue: visible ? 1 : 0,
      duration: DURACION_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animacion.start(({ finished }) => {
      if (finished && !visible) {
        setMontado(false);
      }
    });
    return () => animacion.stop();
  }, [visible, progreso]);

  const translateX = progreso.interpolate({ inputRange: [0, 1], outputRange: [fuera, 0] });

  const renderOpcion = (opcion: SideBarOpcion<T>) => {
    const color = opcion.peligro ? Colors.danger : Colors.brandText;
    return (
      <Pressable
        key={opcion.id}
        onPress={() => onSelect(opcion.id)}
        disabled={opcion.disabled}
        accessibilityRole="button"
        accessibilityLabel={
          opcion.contador ? `${opcion.label}, ${opcion.contador} nuevas` : opcion.label
        }
        style={({ pressed }) => [
          styles.opcion,
          pressed && styles.opcionPresionada,
          opcion.disabled && styles.opcionDeshabilitada,
        ]}
      >
        <View style={[styles.iconoOpcion, opcion.peligro && styles.iconoPeligro]}>
          <Icono nombre={opcion.icono} tamanio={22} color={opcion.peligro ? Colors.danger : Colors.primary} />
        </View>
        <View style={styles.textoOpcion}>
          <AppText weight="medium" style={[styles.labelOpcion, { color }]}>
            {opcion.label}
          </AppText>
          {opcion.descripcion && (
            <AppText style={styles.descripcionOpcion} numberOfLines={1}>
              {opcion.descripcion}
            </AppText>
          )}
        </View>
        {!!opcion.contador && opcion.contador > 0 && (
          <View style={styles.contador}>
            <AppText weight="bold" style={styles.textoContador}>
              {opcion.contador > 99 ? "99+" : opcion.contador}
            </AppText>
          </View>
        )}
        {!opcion.peligro && <Icono nombre="ArrowRight" tamanio={22} color={Colors.outlineVariant} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={montado} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: progreso }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          lado === "izquierda" ? styles.panelIzquierda : styles.panelDerecha,
          { width: ancho, paddingBottom: insets.bottom + 12, transform: [{ translateX }] },
        ]}
        accessibilityViewIsModal
      >
        <View>
          {encabezado && insets.top > 0 && (
            <View style={{ height: insets.top, backgroundColor: Colors.primary }} />
          )}
          {encabezado}
        </View>
        <ScrollView contentContainerStyle={styles.lista} bounces={false}>
          {opciones.map(renderOpcion)}
        </ScrollView>
        {opcionesPie.length > 0 && <View style={styles.pie}>{opcionesPie.map(renderOpcion)}</View>}
        {nota && <AppText style={styles.nota}>{nota}</AppText>}
      </Animated.View>
    </Modal>
  );
}

interface EncabezadoProps {
  titulo: string;
  subtitulo?: string;
  inicial?: string;
  fotoUrl?: string | null;
  /** Texto en una etiqueta bajo el subtítulo, p. ej. el rol. */
  etiqueta?: string;
  /** Contenido extra bajo los datos, p. ej. estadísticas. */
  children?: ReactNode;
  onPress?: () => void;
}

/** Encabezado del `SideBar` con avatar, nombre y datos del usuario. */
export function SideBarEncabezado({
  titulo,
  subtitulo,
  inicial = "?",
  fotoUrl,
  etiqueta,
  children,
  onPress,
}: EncabezadoProps) {
  return (
    <View style={styles.encabezado}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        style={styles.filaEncabezado}
      >
        <View style={styles.avatar}>
          {fotoUrl ? (
            <Image source={{ uri: fotoUrl }} style={styles.avatarImagen} />
          ) : (
            <AppText weight="bold" style={styles.avatarLetra}>{inicial}</AppText>
          )}
        </View>
        <View style={styles.datosEncabezado}>
          <AppText weight="semibold" style={styles.tituloEncabezado} numberOfLines={2}>
            {titulo}
          </AppText>
          {subtitulo && (
            <AppText style={styles.subtituloEncabezado} numberOfLines={1}>
              {subtitulo}
            </AppText>
          )}
          {etiqueta && (
            <View style={styles.etiqueta}>
              <AppText weight="semibold" style={styles.textoEtiqueta}>{etiqueta}</AppText>
            </View>
          )}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    elevation: 16,
    shadowColor: Colors.brandDeep,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    overflow: "hidden",
  },
  panelIzquierda: {
    left: 0,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  panelDerecha: {
    right: 0,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  encabezado: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomRightRadius: 24,
  },
  filaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 22,
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
    fontSize: 26,
    color: Colors.primary,
  },
  datosEncabezado: {
    flex: 1,
    marginLeft: 14,
  },
  tituloEncabezado: {
    fontSize: 18,
    color: Colors.white,
  },
  subtituloEncabezado: {
    fontSize: 13,
    color: Colors.brandSubtitle,
    marginTop: 2,
  },
  etiqueta: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  textoEtiqueta: {
    fontSize: 11,
    color: Colors.white,
  },
  lista: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  opcionPresionada: {
    backgroundColor: Colors.primaryContainer,
  },
  opcionDeshabilitada: {
    opacity: 0.5,
  },
  iconoOpcion: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
  },
  iconoPeligro: {
    backgroundColor: Colors.errorContainerSoft,
  },
  textoOpcion: {
    flex: 1,
  },
  labelOpcion: {
    fontSize: 15,
  },
  descripcionOpcion: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: 1,
  },
  contador: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.danger,
  },
  textoContador: {
    fontSize: 11,
    color: Colors.white,
    includeFontPadding: false,
  },
  pie: {
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  nota: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.outline,
    marginTop: 8,
  },
});
