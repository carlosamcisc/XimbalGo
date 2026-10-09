import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";

interface Props {
  nombre: string;
  inicial?: string;
  saludo?: string;
  onPress: () => void;

  // Colores personalizables
  avatarBackground?: string; 
  avatarTextColor?: string;
  saludoTextColor?: string;
  buenasTextColor?: string;
}

export default function UserHeader({
  nombre,
  inicial = '?',
  saludo,
  onPress,
  avatarBackground = Colors.primary,
  avatarTextColor = Colors.white,
  saludoTextColor = Colors.onSurface,
  buenasTextColor = Colors.onSurfaceVariant,
}: Props) {
  return (
    <View style={styles.container}>
      <Pressable style={[styles.avatar, { backgroundColor: avatarBackground }]} onPress={onPress}>
        <AppText weight="semibold" style={[styles.avatarLetra, { color: avatarTextColor }]}>
          {inicial}
        </AppText>
      </Pressable>
      <View style={styles.textos}>
        <AppText style={[styles.saludoUsuario, { color: saludoTextColor }]}>
          ¡Hola, {nombre}!
        </AppText>
        {saludo && (
          <AppText style={[styles.buenas, { color: buenasTextColor }]}>
            {saludo}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    marginHorizontal: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.brandDeepShadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatarLetra: {
    fontSize: 23,
  },
  textos: {
    marginLeft: 12,
  },
  saludoUsuario: {
    fontSize: 17,
  },
  buenas: {
    fontSize: 13,
    marginTop: 2,
  },
});
