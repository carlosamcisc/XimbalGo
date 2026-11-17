import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Se instala al arrancar, antes de montar pantallas o cargar fuentes. Sin
// handler, Expo descarta la presentación de los avisos en primer plano.
if (Platform.OS === "android" || Platform.OS === "ios") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
