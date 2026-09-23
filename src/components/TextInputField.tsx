import React, { useState } from "react";
import { TextInput, StyleSheet, View, Text, Pressable } from "react-native";
import Colors from "../theme/colors";
import { Icono, NombreIcono } from "./Icono";

interface Prop{
    label?: string;
    value?: string;
    placeholder?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    icono?: NombreIcono;
}

const TextInputField: React.FC<Prop> = ({
    label,
    value,
    placeholder,
    onChangeText,
    secureTextEntry,
    icono,
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [mostrarContrasenia, setMostrarContrasenia] = useState(false);

    const esContrasenia = !!secureTextEntry;

    return(
        <View style={styles.contenedor}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.input, isFocused && styles.inputFocused]}>
                {icono && (
                    <Icono nombre={icono} tamanio={20} color={Colors.outline}/>
                )}
                <TextInput
                     style={styles.texto}
                     value={value}
                     placeholder={placeholder}
                     onChangeText={onChangeText}
                     secureTextEntry={esContrasenia && !mostrarContrasenia}
                     onFocus={() => setIsFocused(true)}
                     onBlur={() => setIsFocused(false)}

                />
                {esContrasenia && (
                    <Pressable onPress={() => setMostrarContrasenia((anterior) => !anterior)}>
                        <Icono
                            nombre={mostrarContrasenia ? 'visibilityOff' : 'visibility'}
                            tamanio={20}
                            color={Colors.outline}
                        />
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        padding: 10,
        paddingVertical: 10,
    },
    label:{
        fontSize: 16,
        marginBottom: 5,
        color: Colors.dark,
    },
    input:{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
        borderRadius: 10,
        paddingHorizontal: 10,
        backgroundColor: Colors.onPrimary
    },
    inputFocused:{
        borderColor: Colors.primary,
    },
    texto:{
        flex: 1,
        fontSize: 12,
        paddingVertical: 10,
    },

});

export default TextInputField;
