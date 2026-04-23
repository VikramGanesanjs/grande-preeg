import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { ConcentrationSignal } from '../../types';

interface ConcentrationMeterProps {
  currentSignal: ConcentrationSignal | null;
  streak: number;
  threshold: 3 | 5;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function ConcentrationMeter({
  currentSignal,
  streak,
  threshold,
}: ConcentrationMeterProps) {
  const isConcentrated = currentSignal === 'Concentrated';

  // Animated style for the status indicator
  const statusStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withSpring(
        isConcentrated ? colors.concentrated : colors.notConcentrated,
        { damping: 20, stiffness: 200 }
      ),
      transform: [
        {
          scale: withSequence(
            withTiming(isConcentrated ? 1.05 : 0.98, { duration: 100 }),
            withSpring(1, { damping: 15, stiffness: 150 })
          ),
        },
      ],
    };
  }, [isConcentrated]);

  // Animated style for the glow effect
  const glowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: withSpring(isConcentrated ? 0.6 : 0, {
        damping: 20,
        stiffness: 150,
      }),
    };
  }, [isConcentrated]);

  return (
    <View style={styles.container}>
      {/* Streak dots */}
      <View style={styles.streakContainer}>
        <Text style={styles.streakLabel}>Focus Streak</Text>
        <View style={styles.dotsContainer}>
          {Array.from({ length: threshold }).map((_, index) => (
            <StreakDot
              key={index}
              filled={index < streak}
              index={index}
              isLatest={index === streak - 1 && streak > 0}
            />
          ))}
        </View>
        <Text style={styles.streakCount}>
          {streak}/{threshold}
        </Text>
      </View>

      {/* Current status indicator */}
      <AnimatedView
        style={[
          styles.statusIndicator,
          statusStyle,
          glowStyle,
          { shadowColor: isConcentrated ? colors.concentrated : colors.notConcentrated },
        ]}
      >
        <Text style={styles.statusText}>
          {currentSignal === 'Concentrated' ? 'FOCUSED' : currentSignal === 'Not Concentrated' ? 'RELAX' : 'READY'}
        </Text>
      </AnimatedView>

      {/* Hint text */}
      <Text style={styles.hintText}>
        {streak === 0
          ? 'Focus to start your streak'
          : streak < threshold
          ? `${threshold - streak} more to advance!`
          : 'Car advancing!'}
      </Text>
    </View>
  );
}

interface StreakDotProps {
  filled: boolean;
  index: number;
  isLatest: boolean;
}

function StreakDot({ filled, index, isLatest }: StreakDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withSpring(
        filled ? colors.concentrated : colors.surfaceLight,
        { damping: 20, stiffness: 200 }
      ),
      transform: [
        {
          scale: withSequence(
            withTiming(isLatest ? 1.3 : 1, { duration: 100 }),
            withSpring(1, { damping: 12, stiffness: 150 })
          ),
        },
      ],
      borderColor: withSpring(
        filled ? colors.neonCyan : colors.hudGlassBorder,
        { damping: 20, stiffness: 200 }
      ),
    };
  }, [filled, isLatest]);

  return (
    <AnimatedView style={[styles.dot, animatedStyle]}>
      {filled && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.dotInner}
        />
      )}
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.md,
  },
  streakContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  streakLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.neonMagenta,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
  },
  streakCount: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  statusIndicator: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.neonRing,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    elevation: 10,
  },
  statusText: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    letterSpacing: 3,
    textShadowColor: 'rgba(34, 211, 238, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  hintText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
