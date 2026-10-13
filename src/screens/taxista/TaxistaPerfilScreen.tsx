import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppText from "../../components/AppText";
import Button from "../../components/Button";
import Card from "../../components/Card";
import TextInputField from "../../components/TextInputField";
import SelectInput from "../../components/SelectInput";
import BottomSheet from "../../components/BottomSheet";
import OptionList from "../../components/OptionList";
import KeyboardAwareScroll from "../../components/KeyboardAwareScroll";
import { BottomTabBar, TABS_TAXISTA } from "../../components/BottomTabBar";
import { ToastMessage } from "../../components/ToastMessaje";
import Colors from "../../theme/colors";
import type { TaxistaStackParamList } from "../../navigation/types";
import { obtenerCatalogoRutas } from "../../infrastructure/supabase/repositories/rutas.repository";
import { cerrarSesionUsuario } from "../../store/autenticacionStore";
import type { RutaCatalogo } from "../../modules/cliente/rutas";
import type { DatosPerfilTaxista, PerfilTaxista, RutaTaxista } from "../../modules/taxista/types";
import { mensajeError } from "../cliente/useClienteInicio";
import { useTaxista } from "./TaxistaContext";
import { pantallaDePestania } from "./navegacion";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaPerfil">;

interface Formulario {
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  horarioTrabajo: string;
  precioRuta: string;
  ruta: RutaTaxista | null;
}

const formularioDesde = (perfil: PerfilTaxista | null): Formulario => ({
  nombres: perfil?.nombres ?? "",
  apellidos: perfil?.apellidos ?? "",
  telefono: perfil?.telefono ?? "",
  direccion: perfil?.direccion ?? "",
  horarioTrabajo: perfil?.horarioTrabajo ?? "",
  precioRuta: perfil?.precioRuta !== null && perfil?.precioRuta !== undefined ? String(perfil.precioRuta) : "",
  ruta: perfil?.ruta ?? null,
});

/** Devuelve los datos listos para guardar, o un mensaje de error. */
function validar(formulario: Formulario): DatosPerfilTaxista | string {
  if (!formulario.nombres.trim() || !formulario.apellidos.trim() || !formulario.telefono.trim()) {
    return "Nombre, apellidos y teléfono son obligatorios.";
  }

  const precioTexto = formulario.precioRuta.trim();
  const precioRuta = precioTexto ? Number(precioTexto) : null;
  if (precioRuta !== null && (!Number.isFinite(precioRuta) || precioRuta < 0)) {
    return "Escribe un precio válido.";
  }

  return {
    nombres: formulario.nombres.trim(),
    apellidos: formulario.apellidos.trim(),
    telefono: formulario.telefono.trim(),
    direccion: formulario.direccion.trim() || null,
    horarioTrabajo: formulario.horarioTrabajo.trim() || null,
    precioRuta,
    rutaId: formulario.ruta?.id ?? null,
  };
}

const TaxistaPerfilScreen = ({ navigation }: Props) => {
  const taxista = useTaxista();
  const { perfil } = taxista;
  const [formulario, setFormulario] = useState<Formulario>(() => formularioDesde(perfil));
  const [guardando, setGuardando] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [rutas, setRutas] = useState<RutaCatalogo[]>([]);
  const [cargandoRutas, setCargandoRutas] = useState(true);
  const [errorRutas, setErrorRutas] = useState(false);
  const [selectorRutaVisible, setSelectorRutaVisible] = useState(false);

  // Rellena el formulario cuando el perfil termina de cargar o se guarda.
  useEffect(() => {
    setFormulario(formularioDesde(perfil));
  }, [perfil?.nombres, perfil?.apellidos, perfil?.telefono, perfil?.direccion, perfil?.horarioTrabajo, perfil?.precioRuta, perfil?.ruta?.id]);

  const cargarRutas = async () => {
    setCargandoRutas(true);
    setErrorRutas(false);
    try {
      setRutas(await obtenerCatalogoRutas());
    } catch {
      setErrorRutas(true);
    } finally {
      setCargandoRutas(false);
    }
  };

  useEffect(() => {
    void cargarRutas();
  }, []);

  const cambiar = (campo: Exclude<keyof Formulario, "ruta">) => (valor: string) =>
    setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const seleccionarRuta = (ruta: RutaCatalogo) => {
    setFormulario((actual) => ({
      ...actual,
      ruta: { id: ruta.id, nombre: ruta.nombre, origen: ruta.origen, destino: ruta.destino, precioBase: ruta.precioBase },
      // Sugiere la tarifa base; el taxista puede cambiarla.
      precioRuta: actual.precioRuta.trim() ? actual.precioRuta : String(ruta.precioBase),
    }));
  };

  const guardar = async () => {
    const datos = validar(formulario);
    if (typeof datos === "string") {
      ToastMessage.show(datos, "long");
      return;
    }
    setGuardando(true);
    const error = await taxista.guardarPerfil(datos);
    setGuardando(false);
    ToastMessage.show(error ?? "Perfil actualizado", error ? "long" : "short");
  };

  const cerrarSesion = async () => {
    setCerrandoSesion(true);
    try {
      // Sin la app abierta no se envía la ubicación: se termina el servicio.
      if (taxista.enServicio) {
        const error = await taxista.cambiarEstadoServicio(false);
        if (error) {
          throw new Error(error);
        }
      }
      await cerrarSesionUsuario();
    } catch (e: unknown) {
      setCerrandoSesion(false);
      ToastMessage.show(mensajeError(e, "No se pudo cerrar la sesión."), "long");
    }
  };

  const confirmarCierre = () => {
    Alert.alert(
      "Cerrar sesión",
      taxista.enServicio
        ? "Se terminará tu servicio y dejarás de recibir solicitudes."
        : "¿Quieres cerrar tu sesión?",
      [
        { text: "Volver", style: "cancel" },
        { text: "Cerrar sesión", style: "destructive", onPress: () => void cerrarSesion() },
      ]
    );
  };

  const opcionesRutas = rutas.map((ruta) => ({
    ...ruta,
    titulo: `${ruta.nombre}\n${ruta.origen} → ${ruta.destino}`,
  }));
  const textoSinRutas = cargandoRutas
    ? "Cargando rutas..."
    : errorRutas
      ? "No se pudieron cargar las rutas."
      : "Todavía no hay rutas registradas.";

  const renderContenido = () => {
    if (taxista.cargando) {
      return (
        <View style={styles.estadoLista}>
          <ActivityIndicator color={Colors.primary} />
          <AppText style={styles.textoEstado}>Cargando tu perfil...</AppText>
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
        <Card style={styles.tarjeta}>
          <AppText weight="semibold" style={styles.tituloTarjeta}>Datos personales</AppText>
          <TextInputField label="Nombre(s) *" value={formulario.nombres} onChangeText={cambiar("nombres")} autoCapitalize="words" />
          <TextInputField label="Apellidos *" value={formulario.apellidos} onChangeText={cambiar("apellidos")} autoCapitalize="words" />
          <TextInputField
            label="Teléfono *"
            value={formulario.telefono}
            placeholder="Los clientes con viaje aceptado lo verán"
            onChangeText={cambiar("telefono")}
            keyboardType="phone-pad"
          />
          <TextInputField label="Dirección" value={formulario.direccion} onChangeText={cambiar("direccion")} autoCapitalize="sentences" />
        </Card>

        <Card style={styles.tarjeta}>
          <AppText weight="semibold" style={styles.tituloTarjeta}>Tu servicio</AppText>
          <SelectInput
            label="Ruta"
            value={formulario.ruta ? `${formulario.ruta.origen} → ${formulario.ruta.destino}` : ""}
            placeholder={cargandoRutas ? "Cargando rutas..." : "Selecciona tu ruta"}
            onPress={() => setSelectorRutaVisible(true)}
            active={selectorRutaVisible}
            iconLeft="map"
            iconRight="ArrowDown"
          />
          {errorRutas && (
            <Pressable onPress={() => void cargarRutas()} accessibilityRole="button" style={styles.reintentarRutas}>
              <AppText weight="semibold" style={styles.enlace}>No se pudieron cargar las rutas. Reintentar</AppText>
            </Pressable>
          )}
          <TextInputField
            label="Horario de trabajo"
            value={formulario.horarioTrabajo}
            placeholder="Ej. Lunes a viernes, 6:00 a 17:00"
            onChangeText={cambiar("horarioTrabajo")}
            autoCapitalize="sentences"
          />
          <TextInputField
            label="Precio por pasajero"
            value={formulario.precioRuta}
            placeholder={formulario.ruta ? `Tarifa base: ${formulario.ruta.precioBase}` : "Escribe el precio..."}
            onChangeText={cambiar("precioRuta")}
            keyboardType="decimal-pad"
          />
          <Button
            titulo={guardando ? "Guardando..." : "Guardar cambios"}
            disabled={guardando}
            onPress={() => void guardar()}
          />
        </Card>

        <Pressable
          onPress={confirmarCierre}
          disabled={cerrandoSesion}
          accessibilityRole="button"
          style={styles.cerrarSesion}
        >
          <AppText weight="semibold" style={styles.textoCerrarSesion}>
            {cerrandoSesion ? "Cerrando sesión..." : "Cerrar sesión"}
          </AppText>
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.statusBar} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.encabezado}>
        <AppText weight="bold" style={styles.titulo}>Mi perfil</AppText>
        <AppText style={styles.subtitulo}>Tus datos, tu ruta y tu tarifa</AppText>
      </View>
      <View style={styles.pantalla}>
        <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
          {renderContenido()}
        </KeyboardAwareScroll>
      </View>

      <BottomSheet visible={selectorRutaVisible} onClose={() => setSelectorRutaVisible(false)}>
        <View>
          <AppText weight="semibold" style={styles.tituloSelector}>Elige tu ruta</AppText>
          <OptionList
            data={opcionesRutas}
            style={styles.listaRutas}
            emptyText={textoSinRutas}
            onSelect={seleccionarRuta}
            onClose={() => setSelectorRutaVisible(false)}
          />
        </View>
      </BottomSheet>

      <BottomTabBar
        tabs={TABS_TAXISTA}
        activeTab="perfil"
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
  reintentarRutas: {
    marginHorizontal: 10,
  },
  tituloSelector: {
    textAlign: "center",
    fontSize: 20,
    marginBottom: 12,
  },
  listaRutas: {
    maxHeight: 320,
  },
  cerrarSesion: {
    alignItems: "center",
    margin: 12,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  textoCerrarSesion: {
    fontSize: 15,
    color: Colors.danger,
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

export default TaxistaPerfilScreen;
