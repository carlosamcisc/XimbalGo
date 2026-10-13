import type { TaxistaTabId } from "../../components/BottomTabBar";
import type { TaxistaStackParamList } from "../../navigation/types";

const PANTALLA_POR_PESTANIA: Record<TaxistaTabId, keyof TaxistaStackParamList> = {
  inicio: "TaxistaInicio",
  viajes: "TaxistaViajes",
  vehiculo: "TaxistaVehiculo",
  perfil: "TaxistaPerfil",
};

export const pantallaDePestania = (pestania: TaxistaTabId) =>
  PANTALLA_POR_PESTANIA[pestania];
