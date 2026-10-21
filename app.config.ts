import type { ConfigContext, ExpoConfig } from "expo/config";

// Extiende app.json con la key de Google Maps, que vive en `.env` para no
// subirla al repositorio. Solo se usa al compilar: queda en el manifest.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-maps",
      { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    ],
  ],
});
