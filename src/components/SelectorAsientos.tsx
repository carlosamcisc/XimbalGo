import { Pressable, StyleSheet, View } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono, type NombreIcono } from "./Icono";

interface Props {
  cantidad: number;
  maximo: number;
  onCambiar: (cantidad: number) => void;
  disabled?: boolean;
}

const BotonCantidad = ({
  icono,
  etiqueta,
  disabled,
  onPress,
}: {
  icono: NombreIcono;
  etiqueta: string;
  disabled: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={etiqueta}
    accessibilityState={{ disabled }}
    hitSlop={6}
    style={({ pressed }) => [
      styles.boton,
      disabled && styles.botonDeshabilitado,
      pressed && styles.botonPresionado,
    ]}
  >
    <Icono nombre={icono} tamanio={24} color={disabled ? Colors.outlineVariant : Colors.primary} />
  </Pressable>
);

/** Cantidad de asientos entre 1 y `maximo`, con botones de menos y más. */
export default function SelectorAsientos({ cantidad, maximo, onCambiar, disabled = false }: Props) {
  return (
    <View style={styles.contenedor}>
      <BotonCantidad
        icono="remove"
        etiqueta="Quitar un asiento"
        disabled={disabled || cantidad <= 1}
        onPress={() => onCambiar(Math.max(1, cantidad - 1))}
      />
      <View
        style={styles.valor}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${cantidad} ${cantidad === 1 ? "asiento" : "asientos"}`}
      >
        <AppText weight="bold" style={styles.numero}>{cantidad}</AppText>
        <AppText style={styles.unidad}>{cantidad === 1 ? "asiento" : "asientos"}</AppText>
      </View>
      <BotonCantidad
        icono="add"
        etiqueta="Agregar un asiento"
        disabled={disabled || cantidad >= maximo}
        onPress={() => onCambiar(Math.min(maximo, cantidad + 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 8,
  },
  boton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  botonDeshabilitado: {
    borderColor: Colors.outlineVariant,
  },
  botonPresionado: {
    backgroundColor: Colors.primaryContainer,
  },
  valor: {
    alignItems: "center",
    minWidth: 80,
  },
  numero: {
    fontSize: 34,
    color: Colors.brandDeep,
  },
  unidad: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
});
