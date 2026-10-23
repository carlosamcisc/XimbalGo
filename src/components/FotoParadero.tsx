import { useState } from "react";
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import Colors from "../theme/colors";
import { Icono } from "./Icono";

interface Props {
  url: string | null;
  style: StyleProp<ImageStyle>;
  tamanioIcono?: number;
  accessibilityLabel?: string;
}

const esUrlRemota = (url: string | null): url is string =>
  url !== null && /^https?:\/\//i.test(url.trim());

/** Foto del paradero; sin foto, o si no carga, muestra el ícono de ubicación. */
export default function FotoParadero({ url, style, tamanioIcono = 22, accessibilityLabel }: Props) {
  // Guarda la URL que falló para volver a intentar si cambia la foto.
  const [urlFallida, setUrlFallida] = useState<string | null>(null);

  if (esUrlRemota(url) && url !== urlFallida) {
    return (
      <Image
        source={{ uri: url.trim() }}
        style={[styles.fondo, style]}
        resizeMode="cover"
        onError={() => setUrlFallida(url)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View style={[styles.fondo, styles.sinFoto, style]} accessibilityLabel={accessibilityLabel}>
      <Icono nombre="locationOn" tamanio={tamanioIcono} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    backgroundColor: Colors.brandSoft,
  },
  sinFoto: {
    alignItems: "center",
    justifyContent: "center",
  },
});
