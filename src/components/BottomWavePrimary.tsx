import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import Colors from "../theme/colors";

const BottomWavePrimary = () => {
    const { height } = useWindowDimensions();

    return (
        <View
            pointerEvents="none"
            style={[
                styles.container,
                {
                    height: height * 0.18,
                },
            ]}
        >
            <Svg
                width="100%"
                height="100%"
                viewBox="0 0 400 150"
                preserveAspectRatio="none"
            >
                {/* Onda azul */}
                <Path
                    d="
                        M0 70
                        C70 105, 120 125, 190 115
                        C260 105, 315 70, 400 90
                        L401 90
                        L401 150
                        L0 150
                        Z
                    "
                    fill={Colors.primary}
                />

                {/* Línea secundaria */}
                <Path
                    d="
                        M0 58
                        C70 93, 120 113, 190 103
                        C260 93, 315 58, 400 78
                    "
                    fill="none"
                    stroke={Colors.primaryContainer}
                    strokeWidth="5"
                />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
    },
});

export default BottomWavePrimary;