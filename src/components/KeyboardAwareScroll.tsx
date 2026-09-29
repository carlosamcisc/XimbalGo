import { KeyboardAvoidingView, ScrollView, ScrollViewProps, StyleSheet } from "react-native";

type KeyboardAwareScrollProps = ScrollViewProps;

// Con edge-to-edge (obligatorio en Android desde SDK 54) la ventana ya no se
// redimensiona al abrir el teclado, así que el KeyboardAvoidingView hace ese trabajo.
const KeyboardAwareScroll = ({
    children,
    keyboardShouldPersistTaps = "handled",
    showsVerticalScrollIndicator = false,
    ...props
}: KeyboardAwareScrollProps) => {
    return (
        <KeyboardAvoidingView style={styles.contenedor} behavior="padding">
            <ScrollView
                {...props}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            >
                {children}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        flex: 1,
    },
});

export default KeyboardAwareScroll;
