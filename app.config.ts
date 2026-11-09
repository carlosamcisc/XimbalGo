import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const pushEnvironment = process.env.EXPO_PUBLIC_PUSH_ENVIRONMENT ?? "development";
  if (!["development", "preview", "production"].includes(pushEnvironment)) {
    throw new Error("EXPO_PUBLIC_PUSH_ENVIRONMENT debe ser development, preview o production.");
  }
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    },
    extra: { ...config.extra, pushEnvironment },
    plugins: [...(config.plugins ?? []), "@maplibre/maplibre-react-native"],
  };
};
