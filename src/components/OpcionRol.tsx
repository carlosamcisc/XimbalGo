import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, NombreIcono } from "./Icono";
import Colors from "../theme/colors";
import AppText from "./AppText";
interface OpcionRolProps {
    icono: NombreIcono;
    titulo: string;
    descripcion: string;
    seleccionado: boolean;
    onPress: () => void;
}

const OpcionRol = ({
    icono,
    titulo,
    descripcion,
    seleccionado,
    onPress,
}: OpcionRolProps) => {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.opcion,
                seleccionado && styles.opcionSeleccionada,
            ]}
        >
            <Icono nombre={icono} tamanio={32} color={Colors.primary} />
            <View style={styles.opcionTexto}>
                <AppText weight="bold" style={styles.opcionTitulo}>{titulo}</AppText>
                <AppText style={styles.opcionDescripcion}>{descripcion}</AppText>
            </View>
            <Icono
                nombre="navigateNext"
                tamanio={24}
                color={seleccionado ? Colors.primary : Colors.outline}
            />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    opcion: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.onPrimary,
        borderColor: Colors.outlineVariant,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    opcionSeleccionada: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    opcionTexto: {
        marginLeft: 16,
        marginRight: 8,
        flex: 1,
    },
    opcionTitulo: {
        fontSize: 16,
    },
    opcionDescripcion: {
        color: Colors.onSurfaceVariant,
        fontSize: 13,
        marginTop: 2,
    },
});

export default OpcionRol;