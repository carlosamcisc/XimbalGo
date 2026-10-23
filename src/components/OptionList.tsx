import React from "react";
import { FlatList, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import AppText from "./AppText";
import Colors from "../theme/colors";

export interface Option {
  id: string;
  titulo: string;
}

interface OptionListProps<T extends Option> {
  data: T[];
  onSelect: (item: T) => void; // devuelve la opción completa, no solo el título
  onClose?: () => void; // opcional, para cerrar modal
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
}

function OptionList<T extends Option>({ data, onSelect, onClose, emptyText, style }: OptionListProps<T>) {
  return (
    <FlatList
      data={data}
      style={style}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        emptyText ? <AppText style={styles.emptyText}>{emptyText}</AppText> : null
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.item}
          onPress={() => {
            onSelect(item);
            onClose?.(); //si existe, cierra modal
          }}
          accessibilityRole="button"
          accessibilityLabel={`Seleccionar ${item.titulo}`}
        >
          <AppText style={styles.textItem}>{item.titulo}</AppText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  textItem: {
    fontSize: 17,
    color: Colors.onSurfaceVariant,
  },
  emptyText: {
    padding: 12,
    textAlign: "center",
    color: Colors.outline,
  },
});

export default OptionList;
