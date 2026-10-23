import { StatusBar } from 'expo-status-bar';
import {
  getStateFromPath as parseNavigationPath,
  NavigationContainer,
} from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { Alert } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import type { AuthStackParamList } from './src/navigation/types';
import {
  obtenerEnlaceRecuperacionInvalido,
  prepararEnlaceAutenticacion,
} from './src/infrastructure/supabase/auth/auth.deep-link';

const linking: LinkingOptions<AuthStackParamList> = {
  prefixes: ['ximbalgo://'],
  config: {
    screens: {
      RestablecerContrasenia: 'restablecer-contrasena',
    },
  },
  getStateFromPath(path, options) {
    const [pathname, query = ''] = path.split('?', 2);
    const normalizedPath = pathname
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();

    if (
      normalizedPath === 'recuperar-contrasena' ||
      normalizedPath === 'restablecer-contrasena'
    ) {
      const recovery = new URLSearchParams(query).get('recovery');
      const safeRecovery =
        recovery === 'verified' || recovery === 'invalid'
          ? recovery
          : 'invalid';

      return parseNavigationPath(
        `restablecer-contrasena?recovery=${safeRecovery}`,
        options
      );
    }

    return parseNavigationPath(path, options);
  },
  async getInitialURL() {
    const url = await ExpoLinking.getInitialURL();
    if (!url) {
      return null;
    }

    try {
      return await prepararEnlaceAutenticacion(url);
    } catch (error: unknown) {
      const mensaje =
        error instanceof Error
          ? error.message
          : 'Solicita un nuevo enlace de recuperación.';
      Alert.alert('Enlace de recuperación inválido', mensaje);
      return obtenerEnlaceRecuperacionInvalido();
    }
  },
  subscribe(listener) {
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      void prepararEnlaceAutenticacion(url)
        .then(listener)
        .catch((error: unknown) => {
          const mensaje =
            error instanceof Error
              ? error.message
              : 'Solicita un nuevo enlace de recuperación.';
          Alert.alert('Enlace de recuperación inválido', mensaje);
          listener(obtenerEnlaceRecuperacionInvalido());
        });
    });

    return () => subscription.remove();
  },
};

export default function App() {

  const [fontsLoaded] = useFonts({
    InterRegular: require("./assets/fonts/Inter_18pt-Regular.ttf"),
    InterMedium: require("./assets/fonts/Inter_18pt-Medium.ttf"),
    InterSemiBold: require("./assets/fonts/Inter_18pt-SemiBold.ttf"),
    InterBold: require("./assets/fonts/Inter_18pt-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
