import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClienteStackParamList } from "../../navigation/types";
import BandejaNotificacionesScreen from "../compartidas/BandejaNotificacionesScreen";
import { useCliente } from "./ClienteContext";

type Props = NativeStackScreenProps<ClienteStackParamList, "ClienteNotificaciones">;
export default function ClienteNotificacionesScreen({ navigation }: Props) {
  const { bandeja } = useCliente();
  return <BandejaNotificacionesScreen bandeja={bandeja} onBack={() => navigation.goBack()}
    onPreferencias={() => navigation.navigate("ClientePreferenciasNotificaciones")}
    onAbrir={aviso => { if (aviso.reservaId) navigation.navigate("ClienteReserva", {
      reservaId: aviso.reservaId, notificacionId: aviso.id,
    }); }} />;
}
