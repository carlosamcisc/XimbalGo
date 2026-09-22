import React, { useState } from "react";
import { TextInput, StyleSheet, View, Text } from "react-native";
import Colors from "../theme/colors";

interface Prop{
    label?: string;
    value?: string;
    placeholder?: string;
    onChangeText?: (text: string) => void;
}

const TextInputField: React.FC<Prop> = ({
    label,
    value,
    placeholder,
    onChangeText
}) => {
    const [isFocused, setIsFocused] = useState(false);
    return(
        <View style={styles.contenedor}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                 style={[styles.input, isFocused && styles.inputFocused]}
                 value={value}
                 placeholder={placeholder}
                 onChangeText={onChangeText}
                 onFocus={() => setIsFocused(true)}
                 onBlur={() => setIsFocused(false)}

            />
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
        borderWidth: 1,
        borderColor: Colors.secondary,
        borderRadius: 10,
        paddingLeft: 10,
        fontSize: 12,
        backgroundColor: Colors.onPrimary
    },
    inputFocused:{
        borderColor: Colors.primary,
    },

});

export default TextInputField;