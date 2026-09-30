import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

type Props = {
    size?: number;
    color?: string;
    opacity?: number;
    style?: ViewStyle;
};

const DecorativeBubble = ({
    size = 80,
    color = "#DDEEFF",
    opacity = 0.7,
    style,
}: Props) => {
    return (
        <View
            pointerEvents="none"
            style={[
                styles.bubble,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    opacity,
                },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    bubble: {
        position: "absolute",
    },
});

export default DecorativeBubble;