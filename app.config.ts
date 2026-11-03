import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), "@maplibre/maplibre-react-native"],
});
