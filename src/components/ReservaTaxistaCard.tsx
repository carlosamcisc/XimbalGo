import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";
import {
  PRESENTACION_ESTADO,
  formatearFecha,
  formatearPrecio,
} from "../modules/cliente/reservas";
import type { ReservaTaxista } from "../modules/taxista/types";

interface ReservaTaxistaCardProps {
  reserva: ReservaTaxista;
  onPress: () => void;
  /** Botones rápidos para una solicitud pendiente. */
  onAceptar?: () => void;
  onRechazar?: () => void;
  procesando?: boolean;
}

const ReservaTaxistaCard: React.FC<ReservaTaxistaCardProps> = ({
  reserva,
  onPress,
  onAceptar,
  onRechazar,
  procesando = false,
}) => {
  const estado = PRESENTACION_ESTADO[reserva.estado];
  const precio = formatearPrecio(reserva.precio);
  const mostrarAcciones = reserva.estado === "pendiente" && onAceptar && onRechazar;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Reservación de ${reserva.nombreCliente}, ${estado.etiqueta}`}
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

      <View style={styles.cliente}>
        <Icono nombre="person" tamanio={18} color={Colors.primary} />
        <AppText weight="semibold" style={styles.nombreCliente} numberOfLines={1}>
          {reserva.nombreCliente}
        </AppText>
        {reserva.numeroAsiento !== null && (
          <AppText style={styles.asiento}>Asiento {reserva.numeroAsiento}</AppText>
        )}
      </View>

      <View style={styles.ruta}>
        <View style={styles.lineaRuta}>
          <View style={[styles.punto, styles.puntoOrigen]} />
          <View style={styles.linea} />
          <View style={[styles.punto, styles.puntoDestino]} />
        </View>
        <View style={styles.paraderos}>
          <AppText style={styles.paradero} numberOfLines={1}>
            {reserva.origen ?? "Ubicación del cliente (ver notas)"}
          </AppText>
          <AppText weight="semibold" style={styles.paradero} numberOfLines={1}>
            {reserva.destino ?? "Paradero no disponible"}
          </AppText>
        </View>
        {precio && <AppText weight="semibold" style={styles.precio}>{precio}</AppText>}
      </View>

      {mostrarAcciones ? (
        <View style={styles.acciones}>
          <Pressable
            onPress={onRechazar}
            disabled={procesando}
            accessibilityRole="button"
            style={({ pressed }) => [styles.boton, styles.botonRechazar, pressed && styles.pressed]}
          >
            <AppText weight="semibold" style={styles.textoRechazar}>Rechazar</AppText>
          </Pressable>
          <Pressable
            onPress={onAceptar}
            disabled={procesando}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.boton,
              styles.botonAceptar,
              (pressed || procesando) && styles.botonAceptarPresionado,
            ]}
          >
            <AppText weight="semibold" style={styles.textoAceptar}>
              {procesando ? "Procesando..." : "Aceptar"}
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pie}>
          <AppText style={styles.textoPie}>Ver detalle</AppText>
          <Icono nombre="ArrowRight" tamanio={20} color={Colors.outlineVariant} />
        </View>
      )}
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
  cliente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nombreCliente: {
    flex: 1,
    fontSize: 15,
    color: Colors.brandText,
  },
  asiento: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  ruta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineaRuta: {
    alignItems: "center",
    alignSelf: "stretch",
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
    gap: 8,
  },
  paradero: {
    fontSize: 14,
    color: Colors.brandText,
  },
  precio: {
    fontSize: 13,
    color: Colors.brandText,
  },
  acciones: {
    flexDirection: "row",
    gap: 10,
  },
  boton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 16,
  },
  botonRechazar: {
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  botonAceptar: {
    backgroundColor: Colors.primary,
  },
  botonAceptarPresionado: {
    backgroundColor: Colors.primaryFixedDim,
  },
  textoRechazar: {
    fontSize: 14,
    color: Colors.danger,
  },
  textoAceptar: {
    fontSize: 14,
    color: Colors.white,
  },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  textoPie: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
});

export default ReservaTaxistaCard;
