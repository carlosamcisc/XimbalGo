import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import {
  PRESENTACION_ESTADO,
  formatearFecha,
  formatearPrecio,
  textoAsientos,
  type ReservaCliente,
} from "../modules/cliente/reservas";

interface ReservaCardProps {
  reserva: ReservaCliente;
  onPress: () => void;
}

const ReservaCard: React.FC<ReservaCardProps> = ({ reserva, onPress }) => {
  const estado = PRESENTACION_ESTADO[reserva.estado];
  const precio = formatearPrecio(reserva.precio);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Reservación ${estado.etiqueta} hacia ${reserva.destino ?? "destino"}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.encabezado}>
        <View style={[styles.estado, { backgroundColor: estado.fondo }]}>
          <AppText weight="semibold" style={[styles.textoEstado, { color: estado.color }]}>
            {estado.etiqueta}
          </AppText>
        </View>
        <AppText style={styles.fecha}>{formatearFecha(reserva.fechaReserva)}</AppText>
      </View>

      <View style={styles.datosViaje}>
        <Icono nombre="eventSeat" tamanio={16} color={Colors.onSurfaceVariant} />
        <AppText style={styles.textoPie}>{textoAsientos(reserva.cantidadAsientos)}</AppText>
        <Icono nombre="calendar" tamanio={16} color={Colors.onSurfaceVariant} />
        <AppText style={styles.textoPie} numberOfLines={1}>
          {reserva.fechaViaje ? formatearFecha(reserva.fechaViaje) : "Lo antes posible"}
        </AppText>
      </View>

      <View style={styles.ruta}>
        <View style={styles.lineaRuta}>
          <View style={[styles.punto, styles.puntoOrigen]} />
          <View style={styles.linea} />
          <View style={[styles.punto, styles.puntoDestino]} />
        </View>
        <View style={styles.paraderos}>
          <AppText style={styles.paradero} numberOfLines={1}>
            {reserva.origen ?? "Mi ubicación"}
          </AppText>
          <AppText weight="semibold" style={styles.paradero} numberOfLines={1}>
            {reserva.destino ?? "Paradero no disponible"}
          </AppText>
        </View>
      </View>

      <View style={styles.pie}>
        <Icono nombre="localTaxi" tamanio={16} color={Colors.onSurfaceVariant} />
        <AppText style={styles.textoPie} numberOfLines={1}>
          {[reserva.matricula, reserva.nombreTaxista].filter(Boolean).join(" · ") || "Taxi no disponible"}
        </AppText>
        {precio && (
          <AppText weight="semibold" style={styles.precio}>{precio}</AppText>
        )}
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
  },
  estado: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  textoEstado: {
    fontSize: 11,
  },
  fecha: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  ruta: {
    flexDirection: "row",
    gap: 10,
  },
  datosViaje: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  precio: {
    fontSize: 13,
    color: Colors.brandText,
  },
});

export default ReservaCard;
