import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import Button from "../../components/Button";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image, useWindowDimensions, View, Text, StyleSheet} from "react-native";
import Colors from "../../theme/colors";
import { StatusBar } from "expo-status-bar";
import { NombreIcono } from "../../components/Icono";

type Props = NativeStackScreenProps<AuthStackParamList, 'Bienvenida'>;

//obtener la imagen
const fondoPantalla = require('../../../assets/bienvenida/bienvenida.png');

const aspecto = 852 / 1846;

//crear la pantalla de bienvenida
const BienvenidaScreen = ({navigation}: Props) =>{
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const handleSiniciar = () =>{
        navigation.navigate('SeleccionRol');
    }

    return(
        <SafeAreaView
        edges={['top']}
        style={styles.pantalla}>
            <StatusBar style="dark" />
            <View style={styles.contenedorText}>
                <Text style={styles.text}>Bienvenido a Ximbal Go</Text>
            </View>
            <Image
                source={fondoPantalla}
                style={[styles.fondopantalla, {width, height: width / aspecto}]}
                resizeMode="cover"
            />
            <View style={styles.contenedorButton}>
                <Button
                titulo="Comienza tu experiencia"
                icono= "navigateNext"
                onPress={handleSiniciar}
                />
            </View>
        </SafeAreaView>
    );

};

//crear estilos de la pantalla
const styles = StyleSheet.create({
    pantalla:{
        flex: 1,
        backgroundColor: Colors.surface,
        justifyContent: "space-between",
    },
    text:{
        color: Colors.white,
        fontSize: 25,
        fontWeight: "bold",
    },
    contenedorText:{
        justifyContent: "center",
        alignItems: "center",
        marginTop: 40,
    },
    contenedorButton:{
        marginBottom: 60,
        margin: 10,
    },
    fondopantalla:{
        flex: 1,
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: -1, // 🔑 la imagen queda detrás
    },
});

export default BienvenidaScreen;