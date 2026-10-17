import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { diasDisponibles, horariosDelDia, type DiaViaje } from "../modules/cliente/fechaViaje";
import { formatearHora } from "../modules/cliente/reservas";

interface Props {
  /** Null: viajar en cuanto pase el taxi. */
  fecha: Date | null;
  onCambiar: (fecha: Date | null) => void;
  disabled?: boolean;
}

interface ChipProps {
  titulo: string;
  detalle?: string;
  activo: boolean;
  disabled: boolean;
  onPress: () => void;
}

const Chip = ({ titulo, detalle, activo, disabled, onPress }: ChipProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ selected: activo, disabled }}
    accessibilityLabel={[titulo, detalle].filter(Boolean).join(" ")}
    style={({ pressed }) => [
      styles.chip,
      activo && styles.chipActivo,
      pressed && !activo && styles.chipPresionado,
      disabled && !activo && styles.chipDeshabilitado,
    ]}
  >
    <AppText weight={activo ? "semibold" : "regular"} style={[styles.textoChip, activo && styles.textoChipActivo]}>
      {titulo}
    </AppText>
    {detalle && (
      <AppText style={[styles.detalleChip, activo && styles.textoChipActivo]}>{detalle}</AppText>
    )}
  </Pressable>
);

const mismoDia = (fecha: Date, dia: DiaViaje) =>
  fecha.getFullYear() === dia.fecha.getFullYear() &&
  fecha.getMonth() === dia.fecha.getMonth() &&
  fecha.getDate() === dia.fecha.getDate();

/** «Lo antes posible» o un día de los próximos 7 y un horario cada 15 minutos. */
export default function SelectorFechaViaje({ fecha, onCambiar, disabled = false }: Props) {
  // Se recalcula al cambiar la selección; así no se ofrecen horarios pasados.
  const dias = useMemo(() => diasDisponibles(), [fecha]);
  const diaSeleccionado = fecha ? dias.find((dia) => mismoDia(fecha, dia)) ?? null : null;
  const horarios = useMemo(
    () => (diaSeleccionado ? horariosDelDia(diaSeleccionado) : []),
    [diaSeleccionado?.clave, fecha]
  );

  const elegirDia = (dia: DiaViaje) => {
    const opciones = horariosDelDia(dia);
    if (opciones.length === 0) {
      return;
    }
    // Conserva la hora elegida si existe en el nuevo día.
    const misma = fecha
      ? opciones.find((horario) =>
          horario.getHours() === fecha.getHours() && horario.getMinutes() === fecha.getMinutes())
      : undefined;
    onCambiar(misma ?? opciones[0]);
  };

  return (
    <View>
      <View style={styles.modos}>
        <Chip
          titulo="Lo antes posible"
          detalle="Cuando pase el taxi"
          activo={fecha === null}
          disabled={disabled}
          onPress={() => onCambiar(null)}
        />
        <Chip
          titulo="Programar"
          detalle="Elige día y hora"
          activo={fecha !== null}
          disabled={disabled}
          onPress={() => fecha === null && elegirDia(dias.find((dia) => horariosDelDia(dia).length > 0) ?? dias[1])}
        />
      </View>

      {fecha && (
        <>
          <AppText style={styles.etiqueta}>Día</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
            {dias.map((dia) => (
              <Chip
                key={dia.clave}
                titulo={dia.etiqueta}
                detalle={dia.detalle}
                activo={diaSeleccionado?.clave === dia.clave}
                disabled={disabled || horariosDelDia(dia).length === 0}
                onPress={() => elegirDia(dia)}
              />
            ))}
          </ScrollView>

          <AppText style={styles.etiqueta}>Hora</AppText>
          <ScrollView style={styles.horarios} nestedScrollEnabled>
            <View style={styles.rejilla}>
              {horarios.map((horario) => (
                <Chip
                  key={horario.getTime()}
                  titulo={formatearHora(horario)}
                  activo={fecha.getTime() === horario.getTime()}
                  disabled={disabled}
                  onPress={() => onCambiar(horario)}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modos: {
    flexDirection: "row",
    gap: 8,
  },
  etiqueta: {
    fontSize: 13,
    color: Colors.outline,
    marginTop: 14,
    marginBottom: 6,
  },
  fila: {
    gap: 8,
    paddingRight: 8,
  },
  horarios: {
    maxHeight: 200,
  },
  rejilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.white,
    minWidth: 76,
  },
  chipActivo: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipPresionado: {
    backgroundColor: Colors.primaryContainer,
  },
  chipDeshabilitado: {
    opacity: 0.4,
  },
  textoChip: {
    fontSize: 14,
    color: Colors.brandText,
  },
  detalleChip: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  textoChipActivo: {
    color: Colors.white,
  },
});
