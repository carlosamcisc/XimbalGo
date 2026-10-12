import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";
import Colors from "../theme/colors";

interface Option {
  id: string;
  titulo: string;
}

interface OptionListProps {
  data: Option[];
  onSelect: (value: string) => void;
  onClose?: () => void; // opcional, para cerrar modal
}

const OptionList: React.FC<OptionListProps> = ({ data, onSelect, onClose }) => {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.item}
          onPress={() => {
            onSelect(item.titulo);
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
};

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
});

export default OptionList;
