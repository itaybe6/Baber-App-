import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, ViewStyle, Animated, Easing } from "react-native";
import Svg, { Rect } from "react-native-svg";

type MovingBorderCardProps = {
  width?: number;
  height?: number;
  radius?: number;
  duration?: number;
  strokeColor?: string;
  strokeWidth?: number;
  accentColor?: string;
  duoTone?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  children?: React.ReactNode;
};

const DEFAULTS = {
  width: 320,
  height: 160,
  radius: 16,
  duration: 3000,
  strokeColor: "#222222", // כהה ניטרלי
  strokeWidth: 2,
  accentColor: "#2e2e2e",
  duoTone: false,
} as const;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function MovingBorderCard({
  width = DEFAULTS.width,
  height = DEFAULTS.height,
  radius = DEFAULTS.radius,
  duration = DEFAULTS.duration,
  strokeColor = DEFAULTS.strokeColor,
  strokeWidth = DEFAULTS.strokeWidth,
  accentColor = DEFAULTS.accentColor,
  duoTone = DEFAULTS.duoTone,
  style,
  contentStyle,
  children,
}: MovingBorderCardProps) {
  const inset = strokeWidth > 0 ? strokeWidth / 2 : 0;

  // היקף מקורב של מלבן (מעוגל קלות) — מספיק בשביל האנימציה
  const perimeter = useMemo(
    () => Math.max(1, 2 * (width - strokeWidth + height - strokeWidth)),
    [width, height, strokeWidth]
  );

  // אורכי הדאש/הפסקה — ארוך יותר
  const dash = useMemo(() => Math.max(20, perimeter * 0.24), [perimeter]);
  const gap = useMemo(() => Math.max(20, perimeter - dash), [perimeter, dash]);

  const dashOffset = useRef(new Animated.Value(0)).current;
  // trail disabled for simple single-line look

  useEffect(() => {
    dashOffset.setValue(0);
    const timing = Animated.timing(dashOffset, {
      toValue: perimeter,
      duration: Math.max(2000, duration * 1.6),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    const reset = Animated.timing(dashOffset, {
      toValue: 0,
      duration: 0,
      useNativeDriver: false,
    });
    const loop = Animated.loop(Animated.sequence([timing, reset]));
    loop.start();
    return () => {
      loop.stop();
    };
  }, [perimeter, duration, dash, dashOffset]);

  return (
    <View style={[styles.wrapper, { width, minHeight: height, borderRadius: radius }, style]}>
      {/* שכבת התוכן */}
      <View style={[styles.content, { borderRadius: radius }, contentStyle]}>
        {children}
      </View>

      {/* שכבת המסגרת האנימטיבית */}
      {strokeWidth > 0 && (
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={StyleSheet.absoluteFill}
        >
          <AnimatedRect
            x={inset}
            y={inset}
            rx={radius}
            ry={radius}
            width={width - strokeWidth}
            height={height - strokeWidth}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="transparent"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={dashOffset as unknown as number}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "visible",
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
});
