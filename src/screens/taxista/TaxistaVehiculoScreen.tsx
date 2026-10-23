import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import TextInputField from "../../components/TextInputField";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import { BottomTabBar, TABS_TAXISTA } from "../../components/BottomTabBar";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { TaxistaStackParamList } from "../../navigation/types";
import { Icono } from "../../components/Icono";
import {
  ETIQUETA_ASIENTO,
  asientoEditable,
  type AsientoTaxista,
  type DatosVehiculo,
  type EstadoAsiento,
  type VehiculoTaxista,
} from "../../modules/taxista/types";
import { useTaxista } from "./TaxistaContext";
import { pantallaDePestania } from "./navegacion";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaVehiculo">;

const CAPACIDAD_MAXIMA = 20;

const COLOR_ASIENTO: Record<EstadoAsiento, { fondo: string; texto: string }> = {
  disponible: { fondo: Colors.brandAccentContainer, texto: Colors.success },
  reservado: { fondo: Colors.primaryContainer, texto: Colors.primary },
  ocupado: { fondo: Colors.surfaceContainerHigh, texto: Colors.brandText },
};

// Ocupado por una reservación aceptada: se libera al cerrar ese viaje.
const etiquetaAsiento = (asiento: AsientoTaxista) =>
  asiento.estado === "ocupado" && asiento.conReserva ? "En viaje" : ETIQUETA_ASIENTO[asiento.estado];

const textoCantidad = (cantidad: number) =>
  cantidad === 1 ? "1 asiento" : `${cantidad} asientos`;

interface Formulario {
  matricula: string;
  marca: string;
  modelo: string;
  anio: string;
  capacidad: string;
  activo: boolean;
}

const formularioDesde = (vehiculo: VehiculoTaxista | null): Formulario => ({
  matricula: vehiculo?.matricula ?? "",
  marca: vehiculo?.marca ?? "",
  modelo: vehiculo?.modelo ?? "",
  anio: vehiculo?.anio ? String(vehiculo.anio) : "",
  capacidad: vehiculo ? String(vehiculo.capacidad) : "",
  activo: vehiculo?.activo ?? true,
});

/** Devuelve los datos listos para guardar, o un mensaje de error. */
function validar(formulario: Formulario): DatosVehiculo | string {
  const matricula = formulario.matricula.trim().toUpperCase();
  if (!matricula) {
    return "Escribe la matrícula del vehículo.";
  }

  const capacidad = Number(formulario.capacidad);
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > CAPACIDAD_MAXIMA) {
    return `La capacidad debe ser un número entre 1 y ${CAPACIDAD_MAXIMA}.`;
  }

  const anioTexto = formulario.anio.trim();
  const anio = anioTexto ? Number(anioTexto) : null;
  const anioMaximo = new Date().getFullYear() + 1;
  if (anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > anioMaximo)) {
    return `Escribe un año entre 1900 y ${anioMaximo}.`;
  }

  return {
    matricula,
    marca: formulario.marca.trim() || null,
    modelo: formulario.modelo.trim() || null,
    anio,
    capacidad,
    activo: formulario.activo,
  };
}

const TaxistaVehiculoScreen = ({ navigation }: Props) => {
  const taxista = useTaxista();
  const { vehiculo } = taxista;
  const [formulario, setFormulario] = useState<Formulario>(() => formularioDesde(vehiculo));
  const [guardando, setGuardando] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);

  // Un asiento seleccionado deja de serlo si un cliente lo reserva mientras tanto.
  const seleccionados = (vehiculo?.asientos ?? []).filter(
    (asiento) => seleccion.includes(asiento.id) && asientoEditable(asiento)
  );
  const porOcupar = seleccionados.filter((asiento) => asiento.estado === "disponible");
  const porLiberar = seleccionados.filter((asiento) => asiento.estado === "ocupado");

  const tocarAsiento = (asiento: AsientoTaxista) => {
    if (!asientoEditable(asiento)) {
      ToastMessage.show(
        `El asiento ${asiento.numero} es de una reservación; se libera al cerrar ese viaje.`,
        "long"
      );
      return;
    }
    setSeleccion((actual) =>
      actual.includes(asiento.id) ? actual.filter((id) => id !== asiento.id) : [...actual, asiento.id]
    );
  };

  const marcar = async (asientos: AsientoTaxista[], ocupados: boolean) => {
    const error = await taxista.marcarAsientos(asientos.map((asiento) => asiento.id), ocupados);
    if (error) {
      ToastMessage.show(error, "long");
      return;
    }
    setSeleccion([]);
    const varios = asientos.length > 1;
    ToastMessage.show(
      ocupados
        ? varios ? `${asientos.length} asientos marcados como ocupados` : "Asiento marcado como ocupado"
        : varios ? `${asientos.length} asientos liberados` : "Asiento liberado"
    );
  };

  // Rellena el formulario cuando el vehículo termina de cargar o se guarda.
  useEffect(() => {
    setFormulario(formularioDesde(vehiculo));
  }, [vehiculo?.id, vehiculo?.matricula, vehiculo?.marca, vehiculo?.modelo, vehiculo?.anio, vehiculo?.capacidad, vehiculo?.activo]);

  const cambiar = (campo: keyof Formulario) => (valor: string) =>
    setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardar = async () => {
    const datos = validar(formulario);
    if (typeof datos === "string") {
      ToastMessage.show(datos, "long");
      return;
    }
    setGuardando(true);
    const error = await taxista.guardarVehiculo(datos);
    setGuardando(false);
    ToastMessage.show(error ?? (vehiculo ? "Vehículo actualizado" : "Vehículo registrado"), error ? "long" : "short");
  };

  const renderContenido = () => {
    if (taxista.cargando) {
      return (
        <View style={styles.estadoLista}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando tu vehículo...</AppText>
        </View>
      );
    }
    if (taxista.error) {
      return (
        <Card>
          <View style={styles.estadoLista}>
            <AppText style={styles.textoEstado}>{taxista.error}</AppText>
            <Pressable onPress={() => void taxista.cargar()} accessibilityRole="button">
              <AppText weight="semibold" style={styles.enlace}>Reintentar</AppText>
            </Pressable>
          </View>
        </Card>
      );
    }
    return (
      <>
        {vehiculo && vehiculo.asientos.length > 0 && (
          <Card style={styles.tarjeta}>
            <AppText weight="semibold" style={styles.tituloTarjeta}>Asientos</AppText>
            <AppText style={styles.ayuda}>
              ¿Subió alguien sin reservar? Toca los asientos libres que ocupó y márcalos como ocupados.
              Cuando se bajen, tócalos de nuevo para liberarlos. Los asientos de las reservaciones se
              actualizan solos.
            </AppText>
            <View style={styles.rejilla}>
              {vehiculo.asientos.map((asiento) => {
                const color = COLOR_ASIENTO[asiento.estado];
                const seleccionado = seleccionados.some((item) => item.id === asiento.id);
                const editable = asientoEditable(asiento);
                return (
                  <Pressable
                    key={asiento.id}
                    onPress={() => tocarAsiento(asiento)}
                    disabled={taxista.marcandoAsientos}
                    style={[
                      styles.asiento,
                      { backgroundColor: color.fondo },
                      seleccionado && styles.asientoSeleccionado,
                      !editable && styles.asientoBloqueado,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: seleccionado, disabled: !editable }}
                    accessibilityLabel={`Asiento ${asiento.numero}, ${etiquetaAsiento(asiento)}`}
                  >
                    {seleccionado && (
                      <View style={styles.marcaSeleccion}>
                        <Icono nombre="checkCircle" tamanio={16} color={Colors.primary} />
                      </View>
                    )}
                    <AppText weight="bold" style={[styles.numeroAsiento, { color: color.texto }]}>
                      {asiento.numero}
                    </AppText>
                    <AppText style={[styles.estadoAsiento, { color: color.texto }]}>
                      {etiquetaAsiento(asiento)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            {porOcupar.length > 0 && (
              <Button
                titulo={taxista.marcandoAsientos ? "Guardando..." : `Marcar ${textoCantidad(porOcupar.length)} como ocupado`}
                disabled={taxista.marcandoAsientos}
                onPress={() => void marcar(porOcupar, true)}
              />
            )}
            {porLiberar.length > 0 && (
              <Button
                titulo={taxista.marcandoAsientos ? "Guardando..." : `Liberar ${textoCantidad(porLiberar.length)}`}
                color={Colors.success}
                borderColor={Colors.success}
                disabled={taxista.marcandoAsientos}
                onPress={() => void marcar(porLiberar, false)}
              />
            )}
            {seleccionados.length > 0 && (
              <Pressable
                onPress={() => setSeleccion([])}
                disabled={taxista.marcandoAsientos}
                accessibilityRole="button"
                style={styles.botonSecundario}
              >
                <AppText weight="semibold" style={styles.enlace}>Quitar selección</AppText>
              </Pressable>
            )}
          </Card>
        )}

        <Card style={styles.tarjeta}>
          <AppText weight="semibold" style={styles.tituloTarjeta}>
            {vehiculo ? "Datos del vehículo" : "Registra tu vehículo"}
          </AppText>
          {!vehiculo && (
            <AppText style={styles.ayuda}>
              Necesitas un vehículo activo para iniciar tu servicio. Los asientos se crean según la capacidad.
            </AppText>
          )}
          <TextInputField
            label="Matrícula *"
            value={formulario.matricula}
            placeholder="Ej. YUC-123-A"
            onChangeText={cambiar("matricula")}
            autoCapitalize="characters"
          />
          <TextInputField
            label="Marca"
            value={formulario.marca}
            placeholder="Ej. Nissan"
            onChangeText={cambiar("marca")}
            autoCapitalize="words"
          />
          <TextInputField
            label="Modelo"
            value={formulario.modelo}
            placeholder="Ej. Urvan"
            onChangeText={cambiar("modelo")}
            autoCapitalize="words"
          />
          <TextInputField
            label="Año"
            value={formulario.anio}
            placeholder="Ej. 2020"
            onChangeText={cambiar("anio")}
            keyboardType="number-pad"
          />
          <TextInputField
            label="Capacidad de pasajeros *"
            value={formulario.capacidad}
            placeholder={`De 1 a ${CAPACIDAD_MAXIMA}`}
            onChangeText={cambiar("capacidad")}
            keyboardType="number-pad"
          />
          <View style={styles.filaSwitch}>
            <View style={styles.textoSwitch}>
              <AppText weight="medium" style={styles.etiquetaSwitch}>Vehículo activo</AppText>
              <AppText style={styles.ayuda}>
                Desactívalo si no está trabajando; dejará de aparecer a los clientes.
              </AppText>
            </View>
            <Switch
              value={formulario.activo}
              onValueChange={(activo) => setFormulario((actual) => ({ ...actual, activo }))}
              trackColor={{ true: Colors.primaryFixedDim, false: Colors.outlineVariant }}
              thumbColor={formulario.activo ? Colors.primary : Colors.surfaceContainerLow}
              accessibilityLabel="Vehículo activo"
            />
          </View>
          <Button
            titulo={guardando ? "Guardando..." : vehiculo ? "Guardar cambios" : "Registrar vehículo"}
            disabled={guardando}
            onPress={() => void guardar()}
          />
        </Card>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.encabezado}>
        <AppText weight="bold" style={styles.titulo}>Mi vehículo</AppText>
        <AppText style={styles.subtitulo}>Datos de tu unidad y estado de los asientos</AppText>
      </View>
      <View style={styles.pantalla}>
        <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
          {renderContenido()}
        </KeyboardAwareScroll>
      </View>
      <BottomTabBar
        tabs={TABS_TAXISTA}
        activeTab="vehiculo"
        onPressTab={(tab) => navigation.navigate(pantallaDePestania(tab))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: Colors.primary,
    flex: 1,
  },
  encabezado: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  titulo: {
    fontSize: 24,
    color: Colors.white,
  },
  subtitulo: {
    fontSize: 15,
    color: Colors.brandSubtitle,
    marginTop: 4,
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
    paddingBottom: 120,
  },
  tarjeta: {
    padding: 14,
  },
  tituloTarjeta: {
    fontSize: 17,
    color: Colors.brandText,
    marginHorizontal: 10,
  },
  ayuda: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginHorizontal: 10,
    marginTop: 4,
  },
  filaSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  textoSwitch: {
    flex: 1,
  },
  etiquetaSwitch: {
    fontSize: 15,
    color: Colors.brandText,
    marginHorizontal: 10,
  },
  rejilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    marginHorizontal: 10,
  },
  asiento: {
    width: 68,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  asientoSeleccionado: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  asientoBloqueado: {
    opacity: 0.75,
  },
  marcaSeleccion: {
    position: "absolute",
    top: 3,
    right: 3,
  },
  numeroAsiento: {
    fontSize: 18,
  },
  botonSecundario: {
    alignItems: "center",
    paddingVertical: 6,
  },
  estadoAsiento: {
    fontSize: 11,
  },
  estadoLista: {
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  textoEstado: {
    fontSize: 14,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
  },
  enlace: {
    fontSize: 14,
    color: Colors.primary,
  },
});

export default TaxistaVehiculoScreen;
