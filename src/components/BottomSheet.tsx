import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../theme/colors";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: DimensionValue;
}

const BottomSheet = ({ visible, onClose, children, height }: BottomSheetProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar panel"
        />
        <View style={[styles.container, { height, paddingBottom: Math.max(30, 16 + insets.bottom) }]}>
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.surface,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 20,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },
});

export default BottomSheet;
