import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import LottieView from "lottie-react-native";
import Cargando from "../../assets/lotties/cliente-cargando.json";
import Reservaciones from "../../assets/lotties/cliente-reservaciones.json";
import Notificaciones from "../../assets/lotties/cliente-notificaciones.json";
import Taxi from "../../assets/lotties/cliente-taxi.json";
import Ubicacion from "../../assets/lotties/cliente-ubicacion.json";
import Viajero from "../../assets/lotties/cliente-viajero.json";
import CompartirUbicacion from "../../assets/lotties/cliente-compartir-ubicacion.json";
import TaxistaCarroOndas from "../../assets/lotties/taxista_carro_ondas.json";

const fuentes = { cargando: Cargando, reservaciones: Reservaciones, notificaciones: Notificaciones, taxi: Taxi, ubicacion: Ubicacion, viajero: Viajero, compartirUbicacion: CompartirUbicacion, taxistaCarroOndas: TaxistaCarroOndas };
export type TipoAnimacionEstado = keyof typeof fuentes;

/** Ilustración decorativa: el mensaje del estado permanece en la pantalla. */
export default function AnimacionEstado({ tipo = "cargando", tamanio = tipo === "cargando" ? 72 : 112, animar = true }: { tipo?: TipoAnimacionEstado; tamanio?: number; animar?: boolean }) {
  const animacion = useRef<LottieView>(null);
  const enfocada = useIsFocused();
  const [reducirMovimiento, setReducirMovimiento] = useState(true);
  const [activa, setActiva] = useState(AppState.currentState === "active");
  const estatica = reducirMovimiento || !animar;
  const fuente = fuentes[tipo];
  const fotogramaEstatico = Math.floor((fuente.ip + fuente.op) / 2);

  useEffect(() => {
    let montado = true;
    let recibioCambio = false;
    const movimiento = AccessibilityInfo.addEventListener("reduceMotionChanged", (valor) => {
      recibioCambio = true;
      setReducirMovimiento(valor);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (montado && !recibioCambio) setReducirMovimiento(valor);
    }).catch(() => { /* Ante un fallo, mantener la ilustración estática. */ });
    const estado = AppState.addEventListener("change", (valor) => setActiva(valor === "active"));
    return () => {
      montado = false;
      movimiento.remove();
      estado.remove();
    };
  }, []);

  useEffect(() => {
    if (estatica) animacion.current?.play(fotogramaEstatico, fotogramaEstatico);
    else if (enfocada && activa) animacion.current?.play();
    else animacion.current?.pause();
  }, [enfocada, activa, estatica, tipo, fotogramaEstatico]);

  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LottieView
        key={`${tipo}-${estatica ? "estatica" : "animada"}`}
        ref={animacion}
        source={fuentes[tipo]}
        onAnimationLoaded={() => {
          if (enfocada && activa && !reducirMovimiento && animar) {
            animacion.current?.play();
          } else if (reducirMovimiento || !animar) {
            // Un segmento de un solo fotograma fuerza el dibujo nativo sin movimiento.
            animacion.current?.play(fotogramaEstatico, fotogramaEstatico);
          } else {
            animacion.current?.pause();
          }
        }}
        autoPlay={false}
        loop={!estatica}
        progress={estatica ? 0.5 : undefined}
        resizeMode="contain"
        style={{ width: tamanio, height: tipo === "taxistaCarroOndas" ? tamanio * 320 / 512 : tamanio }}
      />
    </View>
  );
}
