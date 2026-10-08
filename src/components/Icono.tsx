import { MaterialIcons as Icon } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { StyleSheet, View } from 'react-native';
import Colors from '../theme/colors';

//ICONOS EXPO-VECTOR-ICONS
const ICONOS = {
    //iconos para la pantalla de bienvenida
    navigateNext: 'navigate-next',
    login: 'login',
    //iconos para la seleccion de rol
    person: 'person',
    localTaxi: 'local-taxi',
    adminPanelSettings: 'admin-panel-settings',
    //iconos para el registro
    personAdd: 'person-add',
    arrowBack: 'arrow-back',
    //iconos para los campos de texto
    email: 'email',
    lock: 'lock',
    visibility: 'visibility',
    visibilityOff: 'visibility-off',
    //Iconos en general
    business: 'business',
    info: 'info-outline',
    arrowForward: 'arrow-forward',
    locationHistory: 'location-history',
    locationOn: 'location-on',
    myLocation: 'my-location',
    ArrowRight: 'keyboard-arrow-right',
    //iconos para la pantalla de inicio
    home: 'home',
    map: 'map',
    settings: 'settings',
    moreVert: 'more-vert',
    bookMarks: 'bookmarks',
} as const;

export type NombreIcono = keyof typeof ICONOS;
interface Props {
    nombre: NombreIcono;
    tamanio?: number;
    color?: string;
    backgroundColor?: string;
}

export function Icono({nombre, tamanio = 24, color, backgroundColor}: Props){
    const icono = <Icon name={ICONOS[nombre]} size={tamanio} color={color ?? Colors.primary}/>;

    if (!backgroundColor) {
        return icono;
    }

    return (
        <View style={[styles.background, { backgroundColor }]}>
            {icono}
        </View>
    );
}

//ICONOS EXPO-VECTOR-ICONS-FONTAWESOME6
const ICONOS_FONTAWESOME6 = {
    road: 'road',
    locationArrow: 'location-arrow',
    locationDot: 'location-dot',
} as const;

export type NombreIconoFontAwesome6 = keyof typeof ICONOS_FONTAWESOME6;

interface PropsFontAwesome6 {
    nombre: NombreIconoFontAwesome6;
    tamanio?: number;
    color?: string;
    backgroundColor?: string;
}

export function IconoFontAwesome6({nombre, tamanio = 24, color, backgroundColor}: PropsFontAwesome6){
    const icono = <FontAwesome6 name={ICONOS_FONTAWESOME6[nombre]} size={tamanio} color={color ?? Colors.primary}/>;

    if (!backgroundColor) {
        return icono;
    }

    return (
        <View style={[styles.background, { backgroundColor }]}>
            {icono}
        </View>
    );
}

const styles = StyleSheet.create({
    background: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 30,
    },
});