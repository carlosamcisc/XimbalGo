import React from "react"
import {View, Text, StyleSheet, Pressable} from "react-native"
import Colors from "../theme/colors"
import { Icono, NombreIcono } from "./Icono";

//declarar variables de que lo va a renderizar el boton
interface ButtonProps {
    titulo: string;
    onPress: () => void;
    color?: string;
    icono?: NombreIcono; //icono opcional
}

//crear el componente boton
const Button: React.FC<ButtonProps> = ({
    titulo, 
    color = Colors.primary, //color por defecto si no se pasa otro color
    icono,
    onPress, 
}) =>{
    return(
        <Pressable
        onPress={onPress}
        style={({pressed}) => [
            styles.button,
            {backgroundColor: pressed ? Colors.secondary : color}
        ]}
        >
            {({pressed}) => (
                <View style={styles.contenedor}>
                    <Text style={[
                        styles.text,
                        {color: pressed ? Colors.white : Colors.white},
                    ]}>{titulo}
                    </Text>
                    {icono && <Icono nombre={icono} tamanio={30} color={Colors.white}/>}
                </View>
            )}

        </Pressable>
    );

};

//crear estilos del boton
const styles = StyleSheet.create({
    button:{
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: Colors.primary,
        alignItems: "center"
    },
    contenedor:{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    text:{
        color: Colors.white,
        textAlign: "center",
        fontSize: 16,
        lineHeight: 24,
        fontWeight: "bold",
    },
});

export default Button;