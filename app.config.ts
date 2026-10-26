import type { ConfigContext, ExpoConfig } from "expo/config";

// Extiende app.json con las keys de Google Maps, que viven en `.env` para no
// subirlas al repositorio. Solo se usan al compilar: quedan en el manifest
// (Android) y en el Info.plist (iOS). Cada plataforma lleva su propia key
// porque Google las restringe por paquete o por bundle identifier.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    // Sin key, el plugin no instala Google Maps en iOS: el mapa usa Apple Maps.
    googleMapsIos: Boolean(process.env.GOOGLE_MAPS_IOS_API_KEY),
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
  ],
});
