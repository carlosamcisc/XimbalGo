import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Card from "../../components/Card";
import EncabezadoPantalla from "../../components/EncabezadoPantalla";
import { Icono } from "../../components/Icono";
import Colors from "../../theme/colors";
import type { ClienteStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteAyuda">;

const PREGUNTAS = [
  {
    pregunta: "¿Cómo reservo un asiento?",
    respuesta:
      "En Inicio elige tu origen (un paradero o tu ubicación actual) y tu destino. Después toca un taxi cercano con asientos libres y confirma la reservación. El taxista recibirá tu solicitud.",
  },
  {
    pregunta: "¿Cómo sé si el taxista aceptó mi viaje?",
    respuesta:
      "Tu reservación cambia a «Aceptada» en Mis reservaciones y recibes una notificación. Desde ese momento puedes ver el teléfono del taxista en el detalle.",
  },
  {
    pregunta: "¿Puedo cancelar una reservación?",
    respuesta:
      "Sí, mientras esté pendiente o aceptada. Abre la reservación en Mis reservaciones y toca «Cancelar reservación». Tu asiento queda libre para otro pasajero.",
  },
  {
    pregunta: "¿Por qué no veo taxis cercanos?",
    respuesta:
      "Solo aparecen los taxistas en servicio con asientos libres y ubicación reciente. Revisa que la app tenga permiso de ubicación y desliza hacia abajo para actualizar.",
  },
  {
    pregunta: "¿Qué significa «No se presentó»?",
    respuesta:
      "El taxista cerró la reservación porque no llegaste al punto de abordaje. Si vas a llegar tarde, avísale por teléfono o cancela tu reservación.",
  },
  {
    pregunta: "¿Cómo cambio mis datos o mi contraseña?",
    respuesta:
      "Abre el menú tocando tu avatar en Inicio o el botón de menú en Rutas y Reservaciones. En «Mi perfil» puedes editar tu nombre, teléfono, edad y dirección, y en «Seguridad» cambiar tu contraseña.",
  },
] as const;

const ClienteAyudaScreen = ({ navigation }: Props) => {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <EncabezadoPantalla titulo="Ayuda" subtitulo="Preguntas frecuentes" onBack={() => navigation.goBack()} />
      <View style={styles.pantalla}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.tarjeta}>
            {PREGUNTAS.map((item, indice) => {
              const expandida = abierta === indice;
              return (
                <View key={item.pregunta} style={[styles.item, indice > 0 && styles.itemSeparado]}>
                  <Pressable
                    onPress={() => setAbierta(expandida ? null : indice)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandida }}
                    style={styles.pregunta}
                  >
                    <AppText weight="semibold" style={styles.textoPregunta}>{item.pregunta}</AppText>
                    <Icono
                      nombre={expandida ? "ArrowDown" : "ArrowRight"}
                      tamanio={22}
                      color={expandida ? Colors.primary : Colors.outline}
                    />
                  </Pressable>
                  {expandida && <AppText style={styles.respuesta}>{item.respuesta}</AppText>}
                </View>
              );
            })}
          </Card>

          <Pressable
            onPress={() => navigation.navigate("ClienteReservaciones")}
            accessibilityRole="button"
            style={styles.atajo}
          >
            <Icono nombre="bookMarks" tamanio={22} color={Colors.primary} />
            <AppText weight="semibold" style={styles.textoAtajo}>Ir a mis reservaciones</AppText>
            <Icono nombre="ArrowRight" tamanio={22} color={Colors.primary} />
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: Colors.primary,
    flex: 1,
  },
  pantalla: {
    backgroundColor: Colors.surface,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 40,
  },
  tarjeta: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  item: {
    paddingVertical: 4,
  },
  itemSeparado: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  pregunta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  textoPregunta: {
    flex: 1,
    fontSize: 15,
    color: Colors.brandText,
  },
  respuesta: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
    paddingBottom: 12,
  },
  atajo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
  },
  textoAtajo: {
    flex: 1,
    fontSize: 15,
    color: Colors.primary,
  },
});

export default ClienteAyudaScreen;
