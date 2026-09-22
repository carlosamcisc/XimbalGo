import { MaterialIcons as Icon } from '@expo/vector-icons';
import Colors from '../theme/colors';

const ICONOS = {
    //iconos para la pantalla de bienvenida
    navigateNext: 'navigate-next',
    login: 'login'
} as const;

export type NombreIcono = keyof typeof ICONOS;

interface Props {
    nombre: NombreIcono;
    tamanio?: number;
    color?: string;
}

export function Icono({nombre, tamanio = 24, color}: Props){
    return <Icon name={ICONOS[nombre]} size={tamanio} color={color ?? Colors.primary}/>
}