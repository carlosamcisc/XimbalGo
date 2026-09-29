import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

const BottomWave = () => {
    return (
        // Es solo decorativa: pointerEvents "none" deja pasar los toques a lo que haya debajo
        <View style={styles.contenedor}>
            <Svg
                width="100%"
                height="180"
                viewBox="0 0 400 180"
                preserveAspectRatio="none"
            >
                <Path
                    d="
                        M 0 70
                        C 70 100, 120 150, 200 130
                        C 280 105, 330 115, 400 155
                        L 400 180
                        L 0 180
                        Z
                    "
                    fill="#E8F2FF"
                />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: "none",
    },
});

export default BottomWave;
