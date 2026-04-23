import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path, Rect, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../../constants/theme';

interface CarProps {
  position: number;
  color?: string;
  isConcentrated?: boolean;
  size?: number;
}

const AnimatedView = Animated.createAnimatedComponent(View);

/** Side-profile hypercar facing right; neon underglow when concentrated. */
export function Car({
  position,
  color = colors.playerCar,
  isConcentrated = false,
  size = 100,
}: CarProps) {
  const h = size * 0.42;
  const halfW = size * 0.5;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      left: withSpring(`${position}%`, {
        damping: 16,
        stiffness: 120,
        mass: 0.95,
      }),
    };
  }, [position]);

  const glowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: withSpring(isConcentrated ? 0.95 : 0.35, {
        damping: 18,
        stiffness: 180,
      }),
      shadowRadius: withSpring(isConcentrated ? 18 : 6, {
        damping: 18,
        stiffness: 180,
      }),
    };
  }, [isConcentrated]);

  return (
    <AnimatedView
      style={[
        styles.wrap,
        animatedStyle,
        glowStyle,
        {
          shadowColor: isConcentrated ? colors.neonCyan : color,
          width: size,
          height: h + 8,
          marginLeft: -halfW,
        },
      ]}
    >
      <Svg width={size} height={h} viewBox="0 0 120 50">
        <Defs>
          <LinearGradient id="bodyShine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.85" />
            <Stop offset="0.5" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.primaryDark} stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="underglow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.neonCyan} stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors.neonMagenta} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {isConcentrated && (
          <Ellipse cx={58} cy={44} rx={52} ry={6} fill="url(#underglow)" opacity={0.65} />
        )}

        {/* Rear diffuser / shadow */}
        <Path
          d="M12 42 L108 40 L112 44 L8 46 Z"
          fill="#0f172a"
          opacity={0.45}
        />

        {/* Main body — low wedge, side view */}
        <Path
          d="M14 34 L22 26 L38 22 L72 20 L96 24 L106 30 L108 36 L104 40 L18 42 Z"
          fill="url(#bodyShine)"
        />
        {/* Skirt */}
        <Path
          d="M18 38 L102 36 L100 40 L20 42 Z"
          fill={color}
          opacity={0.55}
        />

        {/* Cabin bubble */}
        <Path
          d="M48 22 L58 14 L78 13 L92 18 L94 24 L50 24 Z"
          fill={colors.surface}
          opacity={0.88}
        />
        <Path
          d="M52 20 L62 16 L82 15 L88 18"
          stroke={colors.neonCyan}
          strokeWidth={0.8}
          opacity={0.5}
          fill="none"
        />

        {/* Rear wing */}
        <Path d="M18 26 L10 18 L12 16 L22 24 Z" fill="#1e293b" />
        <Rect x={8} y={16} width={4} height={10} rx={1} fill="#334155" />

        {/* Wheels */}
        <G>
          <Ellipse cx={32} cy={40} rx={11} ry={7} fill="#0f172a" />
          <Ellipse cx={32} cy={40} rx={7} ry={4.5} fill="#334155" />
          <Ellipse cx={32} cy={40} rx={3} ry={2} fill="#64748b" />
        </G>
        <G>
          <Ellipse cx={86} cy={39} rx={11} ry={7} fill="#0f172a" />
          <Ellipse cx={86} cy={39} rx={7} ry={4.5} fill="#334155" />
          <Ellipse cx={86} cy={39} rx={3} ry={2} fill="#64748b" />
        </G>

        {/* Headlight + beam */}
        <Path
          d="M104 28 L112 26 L114 32 L104 33 Z"
          fill={isConcentrated ? '#fef08a' : '#94a3b8'}
        />
        {isConcentrated && (
          <Path
            d="M114 29 L148 22 L148 38 L114 33 Z"
            fill="url(#underglow)"
            opacity={0.35}
          />
        )}

        {/* Tail light */}
        <Rect x={12} y={28} width={3} height={5} rx={1} fill="#ef4444" opacity={0.9} />
      </Svg>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
  },
});
