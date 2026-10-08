import React from "react";
import { View, StyleSheet } from "react-native";
import Colors from "../theme/colors";
import AppText from "./AppText";

interface BadgeProps {
  value: number | string;
  backgroundColor?: string;
  textColor?: string;
  size?: number;
}

const Badge: React.FC<BadgeProps> = ({
  value,
  backgroundColor = Colors.primary,
  textColor = Colors.white,
  size = 30,
}) => {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <AppText weight="bold" style={[styles.text, { color: textColor }]}>{value}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
    includeFontPadding: false,
  },
});

export default Badge;
