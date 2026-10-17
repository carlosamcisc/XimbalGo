import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "../../components/AppText";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EstadoLista from "../../components/EstadoLista";
import OptionList from "../../components/OptionList";
import SelectInput from "../../components/SelectInput";
import { ToastMessage } from "../../components/ToastMessaje";
import type { TipoPuntoViaje } from "../../modules/cliente/types";
import type { SeleccionViaje } from "./useSeleccionViaje";

const mostrarAviso = (mensaje: string | null) => {
  if (mensaje) {
    ToastMessage.show(mensaje);
  }
};

const aOpciones = (puntos: string[]) => puntos.map((punto) => ({ id: punto, titulo: punto }));

interface Props {
  viaje: SeleccionViaje;
  /** Contenido bajo los campos, p. ej. el botón «Buscar ruta». */
  children?: ReactNode;
}

/** Campos de origen y destino con sus paneles de opciones. */
export default function SelectorViaje({ viaje, children }: Props) {
  const [selectorActivo, setSelectorActivo] = useState<TipoPuntoViaje | null>(null);

  const abrirSelector = (tipo: TipoPuntoViaje) => {
    setSelectorActivo(tipo);
    void viaje.cargarOpciones(tipo);
  };

  const cerrar = () => setSelectorActivo(null);

  const usarUbicacionActual = async () => {
    cerrar();
    mostrarAviso(await viaje.usarUbicacionActual());
  };

  return (
    <>
      <Card>
        <SelectInput
          label="Origen"
          value={viaje.etiquetaOrigen}
          placeholder={viaje.obteniendoUbicacion ? "Obteniendo ubicación..." : "Seleccione el origen"}
          onPress={() => abrirSelector("origen")}
          active={selectorActivo === "origen"}
          iconLeft="locationHistory"
          iconRight="ArrowDown"
        />
        <SelectInput
          label="Destino"
          value={viaje.destino ?? ""}
          placeholder="Seleccione el destino"
          onPress={() => abrirSelector("destino")}
          active={selectorActivo === "destino"}
          iconLeft="locationOn"
          iconRight="ArrowDown"
        />
        {children}
      </Card>

      <BottomSheet visible={selectorActivo === "origen"} onClose={cerrar}>
        <View>
          <AppText style={styles.tituloItems}>Elige tu origen</AppText>
          <EstadoLista
            cargando={viaje.cargandoOpciones && viaje.opciones.origen.length === 0}
            error={viaje.errorOpciones}
            vacio={viaje.opciones.origen.length === 0}
            textoCargando="Cargando orígenes..."
            textoVacio="No hay orígenes disponibles."
            onReintentar={() => void viaje.cargarOpciones("origen")}
          >
            <OptionList
              data={aOpciones(viaje.opciones.origen)}
              style={styles.listaOpciones}
              onSelect={(opcion) => mostrarAviso(viaje.seleccionarOrigen(opcion.titulo))}
              onClose={cerrar}
            />
          </EstadoLista>

          <Button
            titulo={viaje.obteniendoUbicacion ? "Obteniendo ubicación..." : "Mi ubicación actual"}
            disabled={viaje.obteniendoUbicacion}
            onPress={() => void usarUbicacionActual()}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={selectorActivo === "destino"} onClose={cerrar}>
        <View>
          <AppText style={styles.tituloItems}>Elige tu destino</AppText>
          <EstadoLista
            cargando={viaje.cargandoOpciones && viaje.opciones.destino.length === 0}
            error={viaje.errorOpciones}
            vacio={viaje.opciones.destino.length === 0}
            textoCargando="Cargando destinos..."
            textoVacio="No hay destinos disponibles."
            onReintentar={() => void viaje.cargarOpciones("destino")}
          >
            <OptionList
              data={aOpciones(viaje.opciones.destino)}
              style={styles.listaOpciones}
              onSelect={(opcion) => mostrarAviso(viaje.seleccionarDestino(opcion.titulo))}
              onClose={cerrar}
            />
          </EstadoLista>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  tituloItems: {
    textAlign: "center",
    fontSize: 20,
    marginBottom: 12,
  },
  listaOpciones: {
    maxHeight: 320,
  },
});
