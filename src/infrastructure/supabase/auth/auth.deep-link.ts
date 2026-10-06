import * as Linking from "expo-linking";
import { supabase } from "../client";

const recoveryRedirect = "ximbalgo://recuperar-contrasena";
const recoveryScreenUrl =
  "ximbalgo://restablecer-contrasena?recovery=verified";
const invalidRecoveryScreenUrl =
  "ximbalgo://restablecer-contrasena?recovery=invalid";

function obtenerParametros(url: string) {
  const [antesDelFragmento, fragmento] = url.split("#", 2);
  const query = antesDelFragmento.split("?")[1] ?? "";
  const parametros = new URLSearchParams(query);

  new URLSearchParams(fragmento ?? "").forEach((value, key) => {
    parametros.set(key, value);
  });

  return parametros;
}

export async function prepararEnlaceAutenticacion(
  url: string
): Promise<string> {
  if (!url.startsWith(recoveryRedirect)) {
    return url;
  }

  const parametros = obtenerParametros(url);
  const errorDescription =
    parametros.get("error_description") ?? parametros.get("error");
  if (errorDescription) {
    throw new Error(errorDescription.replace(/\+/g, " "));
  }

  const code = parametros.get("code");
  if (code) {
    const type = parametros.get("type");
    if (type && type !== "recovery") {
      throw new Error("El enlace recibido no corresponde a una recuperación.");
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      throw exchangeError;
    }

    return recoveryScreenUrl;
  }

  const accessToken = parametros.get("access_token");
  const refreshToken = parametros.get("refresh_token");

  if (
    parametros.get("type") !== "recovery" ||
    !accessToken ||
    !refreshToken
  ) {
    throw new Error("El enlace de recuperación no es válido o ya venció.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return recoveryScreenUrl;
}

export function obtenerEnlaceRecuperacionInvalido() {
  return invalidRecoveryScreenUrl;
}

export function escucharDeepLinks(
  callback: (url: string) => void
) {
  const subscription =
    Linking.addEventListener("url", ({ url }) => {
      callback(url);
    });

  return () => {
    subscription.remove();
  };
}