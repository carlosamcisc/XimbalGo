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
} from "../modules/cliente/reservas";
import {
  esperaRespuestaOferta,
  puedeOfrecerAsientos,
  type AccionReserva,
  type ReservaTaxista,
} from "../modules/taxista/types";

interface ReservaTaxistaCardProps {
  reserva: ReservaTaxista;
  onPress: () => void;
  /** Botones rápidos para una solicitud pendiente. */
  onAceptar?: () => void;
  onRechazar?: () => void;
  /** Ofrecer menos asientos de los pedidos. */
  onOfrecer?: () => void;
  /** Acción en curso sobre esta reserva; desactiva los botones. */
  accionProcesando?: AccionReserva | "oferta" | null;
}

const ReservaTaxistaCard: React.FC<ReservaTaxistaCardProps> = ({
  reserva,
  onPress,
  onAceptar,
  onRechazar,
  onOfrecer,
  accionProcesando = null,
}) => {
  const procesando = accionProcesando !== null;
  const estado = PRESENTACION_ESTADO[reserva.estado];
  const precio = formatearPrecio(reserva.precio);
  const mostrarAcciones = reserva.estado === "pendiente" && onAceptar && onRechazar;
  const esperandoCliente = esperaRespuestaOferta(reserva);

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
        <AppText style={styles.asiento}>
          {reserva.cantidadAsientos > 1
            ? textoAsientos(reserva.cantidadAsientos)
            : reserva.numeroAsiento !== null ? `Asiento ${reserva.numeroAsiento}` : textoAsientos(1)}
        </AppText>
      </View>
      {reserva.fechaViaje && (
        <View style={styles.cliente}>
          <Icono nombre="calendar" tamanio={16} color={Colors.onSurfaceVariant} />
          <AppText style={styles.asiento}>Programado: {formatearFecha(reserva.fechaViaje)}</AppText>
        </View>
      )}

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

      {esperandoCliente && (
        <View style={styles.aviso}>
          <Icono nombre="schedule" tamanio={16} color={Colors.primary} />
          <AppText style={styles.textoAviso}>
            Ofreciste {textoAsientos(reserva.asientosOfrecidos!)} de {reserva.cantidadAsientos}. Esperando respuesta del cliente.
          </AppText>
        </View>
      )}
      {reserva.motivoTaxista && (
        <View style={styles.aviso}>
          <Icono nombre="info" tamanio={16} color={Colors.onSurfaceVariant} />
          <AppText style={styles.textoAviso} numberOfLines={2}>Motivo: {reserva.motivoTaxista}</AppText>
        </View>
      )}

      {mostrarAcciones ? (
        <View style={styles.contenedorAcciones}>
          <View style={styles.acciones}>
            <Pressable
              onPress={onRechazar}
              disabled={procesando}
              accessibilityRole="button"
              style={({ pressed }) => [styles.boton, styles.botonRechazar, pressed && styles.pressed]}
            >
              <AppText weight="semibold" style={styles.textoRechazar}>
                {accionProcesando === "rechazada" ? "Procesando..." : "Rechazar"}
              </AppText>
            </Pressable>
            {!esperandoCliente && (
              <Pressable
                onPress={onAceptar}
                disabled={procesando}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.boton,
                  styles.botonAceptar,
                  (pressed || accionProcesando === "aceptada") && styles.botonAceptarPresionado,
                ]}
              >
                <AppText weight="semibold" style={styles.textoAceptar}>
                  {accionProcesando === "aceptada" ? "Procesando..." : "Aceptar"}
                </AppText>
              </Pressable>
            )}
          </View>
          {onOfrecer && puedeOfrecerAsientos(reserva) && (
            <Pressable
              onPress={onOfrecer}
              disabled={procesando}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botonOfrecer, pressed && styles.pressed]}
            >
              <Icono nombre="eventSeat" tamanio={18} color={Colors.primary} />
              <AppText weight="semibold" style={styles.textoOfrecer}>
                {accionProcesando === "oferta" ? "Procesando..." : "No tengo todos: ofrecer menos asientos"}
              </AppText>
            </Pressable>
          )}
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
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSoft,
  },
  textoAviso: {
    flex: 1,
    fontSize: 12,
    color: Colors.brandText,
  },
  contenedorAcciones: {
    gap: 8,
  },
  acciones: {
    flexDirection: "row",
    gap: 10,
  },
  botonOfrecer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 16,
  },
  textoOfrecer: {
    fontSize: 13,
    color: Colors.primary,
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
