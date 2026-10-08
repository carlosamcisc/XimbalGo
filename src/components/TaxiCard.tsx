import React from "react";
import { View, StyleSheet } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";
import { Icono } from "./Icono";

interface TaxiCardProps {
    nombre: string;
    distancia: string;   // Ej: "2 km"
    asientos: number;    // Ej: 4
    lleno?: boolean;     // Si está lleno
}

const TaxiCard: React.FC<TaxiCardProps> = ({ nombre, distancia, asientos, lleno }) => {
    return (
        <View>
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Icono nombre="localTaxi" tamanio={21} color={Colors.primary} />
                </View>
                <View style={styles.details}>
                    <AppText weight="semibold" style={styles.nombre}>{nombre}</AppText>
                    <View style={styles.distanceRow}>
                        <Icono nombre="myLocation" tamanio={13} color={Colors.onSurfaceVariant} />
                        <AppText style={styles.distancia}>{distancia} de distancia</AppText>
                    </View>
                </View>
                <View style={[styles.status, lleno ? styles.fullStatus : styles.availableStatus]}>
                    <AppText
                        weight="semibold"
                        style={[styles.statusText, lleno ? styles.fullText : styles.availableText]}
                    >
                        {lleno ? "Lleno" : `${asientos} asientos`}
                    </AppText>
                </View>
            </View>
            <View style={styles.divider} />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    iconContainer: {
        width: 43,
        height: 43,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.brandSoft,
    },
    details: {
        flex: 1,
        marginLeft: 11,
    },
    nombre: {
        fontSize: 14,
        color: Colors.brandText,
    },
    distanceRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        gap: 4,
    },
    distancia: {
        fontSize: 12,
        color: Colors.onSurfaceVariant,
    },
    status: {
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    availableStatus: {
        backgroundColor: Colors.brandAccentContainer,
    },
    fullStatus: {
        backgroundColor: Colors.errorContainerSoft,
    },
    statusText: {
        fontSize: 11,
    },
    availableText: {
        color: Colors.brandAccentStrong,
    },
    fullText: {
        color: Colors.error,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginLeft: 55,
    },
});

export default TaxiCard;
