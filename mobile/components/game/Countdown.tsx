import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import { colors, typography } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CountdownProps {
  value: number; // 3, 2, 1, or 0 for "GO!"
}

export function Countdown({ value }: CountdownProps) {
  const displayText = value > 0 ? value.toString() : 'GO!';
  const displayColor = value > 0 ? colors.text : colors.concentrated;

  return (
    <View style={styles.overlay}>
      <Animated.View
        key={value}
        entering={ZoomIn.duration(200).springify()}
        exiting={FadeOut.duration(150)}
        style={styles.container}
      >
        <Animated.Text style={[styles.countdownText, { color: displayColor }]}>
          {displayText}
        </Animated.Text>
        
        {value > 0 && (
          <Text style={styles.subText}>Get ready to focus...</Text>
        )}
      </Animated.View>
      
      {/* Pulse rings */}
      {value > 0 && (
        <Animated.View
          key={`ring-${value}`}
          entering={FadeIn.duration(100)}
          style={styles.pulseRing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '700',
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  subText: {
    fontSize: typography.fontSizes.lg,
    color: colors.textSecondary,
    marginTop: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: colors.primary,
    opacity: 0.3,
  },
});
