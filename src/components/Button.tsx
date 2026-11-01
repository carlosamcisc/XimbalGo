import React from "react"
import { View, StyleSheet, Pressable } from "react-native"
import Colors from "../theme/colors"
import { Icono, NombreIcono } from "./Icono";
import AppText from "./AppText";

//declarar variables de que lo va a renderizar el boton
interface ButtonProps {
    titulo: string;
    onPress: () => void;
    color?: string;
    borderColor?: string;
    icono?: NombreIcono; //icono opcional
    colorTitulo?: string;
    posicionIcono?: "izquierda" | "derecha";
    colorIcono?: string;
    disabled?: boolean;
}

//crear el componente boton
const Button: React.FC<ButtonProps> = ({
    titulo,
    color = Colors.primary, //color por defecto si no se pasa otro color
    borderColor = Colors.primary,
    icono,
    colorTitulo = Colors.white,
    posicionIcono = "derecha",
    colorIcono = Colors.white,
    onPress,
    disabled = false,
}) => {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: disabled ? Colors.outlineVariant : pressed ? Colors.primaryContainer : color,
                    borderColor: disabled ? Colors.outlineVariant : pressed ? Colors.primaryContainer : borderColor,
                },
                disabled && styles.buttonDeshabilitado,
            ]}
        >
            <View style={[styles.contenedor, posicionIcono === "izquierda" && styles.iconoIzquierdo]}>
                    <AppText weight="bold" style={[
                        styles.text,
                        { color: disabled ? Colors.outline : colorTitulo },
                    ]}>
                        {titulo}
                    </AppText>
                    {icono && <Icono nombre={icono} tamanio={30} color={disabled ? Colors.outline : colorIcono} />}
                </View>

        </Pressable>
    );

};

//crear estilos del boton
const styles = StyleSheet.create({
    button: {
        borderRadius: 30,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: Colors.primary,
        alignItems: "center"
    },
    buttonDeshabilitado: {
        borderColor: Colors.outlineVariant,
    },
    contenedor: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },
    iconoIzquierdo: {
        flexDirection: "row-reverse",
    },
    text: {
        color: Colors.white,
        textAlign: "center",
        fontSize: 17,
        lineHeight: 24,
    },
});

export default Button;
