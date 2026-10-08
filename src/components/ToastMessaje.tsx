import { ToastAndroid, Platform } from "react-native";

export const ToastMessage = {
  show: (mensaje: string, duracion: "short" | "long" = "short") => {
    if (Platform.OS === "android") {
      ToastAndroid.show(
        mensaje,
        duracion === "short" ? ToastAndroid.SHORT : ToastAndroid.LONG
      );
    } else {
      // 🔑 En iOS puedes usar otra librería como react-native-toast-message
      console.log("Toast:", mensaje);
    }
  },
};
