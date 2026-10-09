import { Picker } from "@react-native-picker/picker";
import { StyleSheet, View } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono, NombreIcono, IconoFontAwesome6, NombreIconoFontAwesome6 } from "./Icono";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  iconLeft?: NombreIconoFontAwesome6;   // 🔑 icono opcional a la izquierda
  iconRight?: NombreIcono;  // 🔑 icono opcional a la derecha
}

const SelectInput = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Mi ubicación actual",
  iconLeft,
  iconRight,
}: SelectInputProps) => {
  return (
    <View style={styles.container}>
      {label && <AppText style={styles.label}>{label}</AppText>}
      <View style={styles.pickerRow}>
        {iconLeft && (
          <IconoFontAwesome6 nombre={iconLeft} tamanio={22} color={Colors.primary} backgroundColor={Colors.primaryContainer}/>
        )}
        <View style={styles.pickerContainer}>
          <Picker<string>
            accessibilityLabel={label}
            selectedValue={value}
            onValueChange={onChange}
            style={styles.picker}
          >
            <Picker.Item label={placeholder} value="" />
            {options.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
        {iconRight && (
          <Icono nombre={iconRight} tamanio={22} color={Colors.primary} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSoft,
    overflow: "hidden",
    paddingHorizontal: 7,
  },
  pickerContainer: {
    flex: 1,
  },
  picker: {
    color: Colors.onSurfaceVariant,
    height: 50,
    fontSize: 14,
  },
});

export default SelectInput;
