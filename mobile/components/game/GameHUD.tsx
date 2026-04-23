import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface GameHUDProps {
  elapsedTime: number; // in milliseconds
  progress: number; // 0-100 percentage
  totalAdvances: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
}

export function GameHUD({
  elapsedTime,
  progress,
  totalAdvances,
  isPaused,
  onPause,
  onResume,
}: GameHUDProps) {
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <View style={styles.container}>
      {/* Top row - Time and Pause */}
      <View style={styles.topRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.timeValue}>{formatTime(elapsedTime)}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.pauseButton,
            pressed && styles.pauseButtonPressed,
          ]}
          onPress={isPaused ? onResume : onPause}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={24}
            color={colors.text}
          />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.miniStat}>
          <Ionicons name="flash" size={16} color={colors.neonCyan} />
          <Text style={styles.miniStatValue}>{totalAdvances}</Text>
          <Text style={styles.miniStatLabel}>advances</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    backgroundColor: colors.hudGlass,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.hudGlassBorder,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.neonCyan,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  timeValue: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    textShadowColor: colors.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.hudGlass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.neonMagenta,
  },
  pauseButtonPressed: {
    backgroundColor: 'rgba(232, 121, 249, 0.18)',
    transform: [{ scale: 0.95 }],
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hudGlassBorder,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.neonCyan,
    borderRadius: borderRadius.full,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
  },
  progressText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
    width: 45,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.hudGlass,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.hudGlassBorder,
  },
  miniStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  miniStatLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
});
