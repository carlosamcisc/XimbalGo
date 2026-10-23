import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import { formatearPrecio } from "../modules/cliente/reservas";
import {
  formatearDuracion,
  formatearKilometros,
  type RutaCliente,
} from "../modules/cliente/rutas";

interface RutaCardProps {
  ruta: RutaCliente;
  onPress: () => void;
}

const RutaCard: React.FC<RutaCardProps> = ({ ruta, onPress }) => {
  const precio = formatearPrecio(ruta.precioDesde);
  const enServicio = ruta.taxistasEnServicio > 0;
  const datosViaje = [
    formatearKilometros(ruta.distanciaKm),
    formatearDuracion(ruta.tiempoEstimadoMin),
  ].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ruta de ${ruta.origen} a ${ruta.destino}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.encabezado}>
        <View style={[styles.estado, enServicio ? styles.estadoActivo : styles.estadoInactivo]}>
          <AppText
            weight="semibold"
            style={[styles.textoEstado, { color: enServicio ? Colors.success : Colors.outline }]}
          >
            {enServicio
              ? `${ruta.taxistasEnServicio} en servicio`
              : "Sin taxis en servicio"}
          </AppText>
        </View>
        {precio && (
          <AppText weight="semibold" style={styles.precio}>Desde {precio}</AppText>
        )}
      </View>

      <View style={styles.ruta}>
        <View style={styles.lineaRuta}>
          <View style={[styles.punto, styles.puntoOrigen]} />
          <View style={styles.linea} />
          <View style={[styles.punto, styles.puntoDestino]} />
        </View>
        <View style={styles.paraderos}>
          <AppText style={styles.paradero} numberOfLines={1}>{ruta.origen}</AppText>
          <AppText weight="semibold" style={styles.paradero} numberOfLines={1}>{ruta.destino}</AppText>
        </View>
      </View>

      <View style={styles.pie}>
        <Icono nombre="groups" tamanio={16} color={Colors.onSurfaceVariant} />
        <AppText style={styles.textoPie} numberOfLines={1}>
          {[
            `${ruta.taxistas.length} ${ruta.taxistas.length === 1 ? "taxista" : "taxistas"}`,
            enServicio && `${ruta.asientosDisponibles} asientos libres`,
            datosViaje,
          ].filter(Boolean).join(" · ")}
        </AppText>
        <Icono nombre="ArrowRight" tamanio={20} color={Colors.outlineVariant} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 12,
    elevation: 1,
    shadowColor: Colors.brandDeep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    backgroundColor: Colors.white,
  },
  pressed: {
    backgroundColor: Colors.surfaceSoft,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  estado: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  estadoActivo: {
    backgroundColor: Colors.brandAccentContainer,
  },
  estadoInactivo: {
    backgroundColor: Colors.surfaceMuted,
  },
  textoEstado: {
    fontSize: 11,
  },
  precio: {
    fontSize: 13,
    color: Colors.brandText,
  },
  ruta: {
    flexDirection: "row",
    gap: 10,
  },
  lineaRuta: {
    alignItems: "center",
    paddingVertical: 4,
  },
  punto: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  puntoOrigen: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  puntoDestino: {
    backgroundColor: Colors.primary,
  },
  linea: {
    flex: 1,
    width: 2,
    minHeight: 14,
    backgroundColor: Colors.routeLine,
  },
  paraderos: {
    flex: 1,
    justifyContent: "space-between",
    gap: 8,
  },
  paradero: {
    fontSize: 14,
    color: Colors.brandText,
  },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  textoPie: {
    flex: 1,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
});

export default RutaCard;
