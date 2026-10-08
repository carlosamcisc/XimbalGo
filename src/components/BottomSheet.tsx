import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Colors from "../theme/colors";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

const BottomSheet = ({ visible, onClose, children }: BottomSheetProps) => (
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
      <View style={styles.container}>
        <View style={styles.handle} />
        {children}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
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
