import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import { Icono, NombreIcono } from "./Icono";
import AppText from "./AppText";

interface Prop {
  label?: string;
  value: string;
  placeholder: string;
  onPress: () => void; // callback para abrir modal/picker
  active?: boolean;
  iconLeft?: NombreIcono;
  iconRight?: NombreIcono;
  disabled?: boolean;
  error?: string;
}

const SelectInput: React.FC<Prop> = ({
  label,
  value,
  placeholder,
  onPress,
  active = false,
  iconLeft,
  iconRight,
  disabled = false,
  error,
}) => {
  const handlePress = () => {
    if (!disabled) {
      onPress();
    }
  };

  const displayText = value || placeholder;
  const isPlaceholder = !value;

  return (
    <View style={styles.container}>
      {label && <AppText style={styles.label}>{label}</AppText>}

      <Pressable
        style={[
          styles.input,
          active && styles.inputFocused,
          error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={label || "Seleccionar"}
        accessibilityHint={`Presiona para seleccionar. Valor actual: ${displayText}`}
      >
        {iconLeft && (
          <Icono
            nombre={iconLeft}
            tamanio={22}
            color={disabled ? Colors.outlineVariant : Colors.primary}
            backgroundColor={Colors.primaryContainer}
          />
        )}

        <AppText
          style={[
            styles.text,
            isPlaceholder && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {displayText}
        </AppText>

        {iconRight && (
          <Icono
            nombre={iconRight}
            tamanio={22}
            color={disabled ? Colors.outlineVariant : Colors.onSurfaceVariant}
          />
        )}
      </Pressable>

      {error && <AppText style={styles.errorText}>{error}</AppText>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 10,
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    // Con Inter el peso va en fontFamily: iOS ignora la fuente si lleva fontWeight.
    fontFamily: "InterSemiBold",
    marginBottom: 8,
    color: Colors.onSurfaceVariant,
  },
  input: {
    elevation: 1,
    shadowColor: Colors.brandDeep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: 20,
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.onPrimary,
    justifyContent: "space-between",
    gap: 8,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.outlineVariant,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontFamily: "InterMedium",
    color: Colors.onSurfaceVariant,
  },
  placeholderText: {
    color: Colors.outlineVariant,
    fontFamily: "InterRegular",
  },
  disabledText: {
    color: Colors.outlineVariant,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 5,
    marginLeft: 14,
  },
});

export default SelectInput;
