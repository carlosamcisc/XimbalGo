import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TaxistaStackParamList } from "../../navigation/types";
import BandejaNotificacionesScreen from "../compartidas/BandejaNotificacionesScreen";
import { useTaxista } from "./TaxistaContext";

type Props = NativeStackScreenProps<TaxistaStackParamList, "TaxistaNotificaciones">;
export default function TaxistaNotificacionesScreen({ navigation }: Props) {
  const { bandeja } = useTaxista();
  return <BandejaNotificacionesScreen bandeja={bandeja} onBack={() => navigation.goBack()}
    onPreferencias={() => navigation.navigate("TaxistaPreferenciasNotificaciones")}
    onAbrir={aviso => { if (aviso.reservaId) navigation.navigate("TaxistaReserva", {
      reservaId: aviso.reservaId, notificacionId: aviso.id,
    }); }} />;
}
