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
    disabled?: boolean;
}

//crear el componente boton
const Button: React.FC<ButtonProps> = ({
    titulo,
    color = Colors.primary, //color por defecto si no se pasa otro color
    icono,
    onPress,
    disabled = false,
}) =>{
    return(
        <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({pressed}) => [
            styles.button,
            {backgroundColor: disabled ? Colors.outlineVariant : pressed ? Colors.secondary : color},
            disabled && styles.buttonDeshabilitado,
        ]}
        >
            {({pressed}) => (
                <View style={styles.contenedor}>
                    <Text style={[
                        styles.text,
                        {color: disabled ? Colors.outline : Colors.white},
                    ]}>{titulo}
                    </Text>
                    {icono && <Icono nombre={icono} tamanio={30} color={disabled ? Colors.outline : Colors.white}/>}
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
    buttonDeshabilitado:{
        borderColor: Colors.outlineVariant,
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