import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { ConcentrationSignal } from '../../types';

interface CarProps {
  position: number; // 0-100 percentage
  color?: string;
  isConcentrated?: boolean;
  size?: number;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function Car({ 
  position, 
  color = colors.playerCar, 
  isConcentrated = false,
  size = 60,
}: CarProps) {
  // Animated position with spring physics
  const animatedStyle = useAnimatedStyle(() => {
    return {
      left: withSpring(`${position}%`, {
        damping: 15,
        stiffness: 100,
        mass: 1,
      }),
    };
  }, [position]);

  // Glow effect when concentrated
  const glowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: withSpring(isConcentrated ? 0.8 : 0.3, {
        damping: 20,
        stiffness: 150,
      }),
      shadowRadius: withSpring(isConcentrated ? 12 : 4, {
        damping: 20,
        stiffness: 150,
      }),
    };
  }, [isConcentrated]);

  return (
    <AnimatedView style={[styles.container, animatedStyle, glowStyle, { shadowColor: color }]}>
      <Svg width={size} height={size * 0.6} viewBox="0 0 100 60">
        {/* Car body */}
        <G>
          {/* Main body */}
          <Path
            d="M15 35 L20 20 L35 15 L65 15 L80 20 L85 35 L85 45 L15 45 Z"
            fill={color}
          />
          
          {/* Roof */}
          <Path
            d="M30 20 L35 10 L65 10 L70 20 Z"
            fill={color}
            opacity={0.9}
          />
          
          {/* Windows */}
          <Path
            d="M33 18 L37 12 L50 12 L50 18 Z"
            fill={colors.surface}
            opacity={0.8}
          />
          <Path
            d="M52 18 L52 12 L63 12 L67 18 Z"
            fill={colors.surface}
            opacity={0.8}
          />
          
          {/* Front light */}
          <Rect
            x="82"
            y="28"
            width="5"
            height="8"
            rx="1"
            fill={isConcentrated ? '#FBBF24' : '#94A3B8'}
          />
          
          {/* Back light */}
          <Rect
            x="13"
            y="30"
            width="4"
            height="6"
            rx="1"
            fill="#EF4444"
          />
          
          {/* Wheels */}
          <Circle cx="28" cy="45" r="8" fill="#1E293B" />
          <Circle cx="28" cy="45" r="5" fill="#475569" />
          <Circle cx="72" cy="45" r="8" fill="#1E293B" />
          <Circle cx="72" cy="45" r="5" fill="#475569" />
        </G>
      </Svg>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    transform: [{ translateX: -30 }], // Center the car on its position
    shadowOffset: { width: 0, height: 2 },
  },
});
