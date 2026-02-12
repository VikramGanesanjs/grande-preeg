import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../../components/ui';

export default function ResultsScreen() {
  const router = useRouter();
  
  // Get results from game store
  const getResults = useGameStore((state) => state.getResults);
  const resetGame = useGameStore((state) => state.resetGame);
  const results = getResults();
  
  // Settings
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  
  // Celebration haptic on mount
  useEffect(() => {
    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [hapticsEnabled]);
  
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${seconds}.${tenths}s`;
  };
  
  const handlePlayAgain = () => {
    resetGame();
    router.replace('/racing/game');
  };
  
  const handleGoHome = () => {
    resetGame();
    router.replace('/racing');
  };
  
  const handleGoToGames = () => {
    resetGame();
    router.replace('/');
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {/* Trophy/celebration */}
        <Animated.View 
          entering={ZoomIn.delay(200).duration(500).springify()}
          style={styles.trophyContainer}
        >
          <View style={styles.trophyCircle}>
            <Ionicons name="trophy" size={64} color={colors.warning} />
          </View>
        </Animated.View>
        
        {/* Title */}
        <Animated.View 
          entering={FadeInUp.delay(400).duration(500)}
          style={styles.titleContainer}
        >
          <Text style={styles.title}>Race Complete!</Text>
          <Text style={styles.subtitle}>Great job focusing your mind</Text>
        </Animated.View>
        
        {/* Stats grid */}
        <Animated.View 
          entering={FadeInUp.delay(600).duration(500)}
          style={styles.statsGrid}
        >
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={28} color={colors.primary} />
            <Text style={styles.statValue}>{formatTime(results.completionTime)}</Text>
            <Text style={styles.statLabel}>Completion Time</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="flash-outline" size={28} color={colors.secondary} />
            <Text style={styles.statValue}>{results.totalAdvances}</Text>
            <Text style={styles.statLabel}>Total Advances</Text>
          </View>
          
          <View style={[styles.statCard, styles.statCardWide]}>
            <Ionicons name="analytics-outline" size={28} color={colors.concentrated} />
            <Text style={styles.statValue}>{results.concentrationPercentage}%</Text>
            <Text style={styles.statLabel}>Focus Rate</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${results.concentrationPercentage}%` }
                ]} 
              />
            </View>
          </View>
        </Animated.View>
        
        {/* Concentration history visualization */}
        <Animated.View 
          entering={FadeInUp.delay(800).duration(500)}
          style={styles.historyContainer}
        >
          <Text style={styles.historyLabel}>Focus Pattern</Text>
          <View style={styles.historyGrid}>
            {results.concentrationHistory.slice(-50).map((focused, index) => (
              <View
                key={index}
                style={[
                  styles.historyDot,
                  { backgroundColor: focused ? colors.concentrated : colors.surfaceLight },
                ]}
              />
            ))}
          </View>
        </Animated.View>
        
        {/* Action buttons */}
        <Animated.View 
          entering={FadeInUp.delay(1000).duration(500)}
          style={styles.buttonContainer}
        >
          <Button
            title="Race Again"
            onPress={handlePlayAgain}
            variant="primary"
            size="lg"
            style={styles.button}
          />
          <Button
            title="Back to Racing"
            onPress={handleGoHome}
            variant="outline"
            size="md"
            style={styles.button}
          />
          <Button
            title="All Games"
            onPress={handleGoToGames}
            variant="ghost"
            size="md"
            style={styles.button}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  trophyContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trophyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.warning,
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statCardWide: {
    minWidth: '100%',
  },
  statValue: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginVertical: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.concentrated,
    borderRadius: borderRadius.full,
  },
  historyContainer: {
    marginBottom: spacing.xl,
  },
  historyLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  buttonContainer: {
    gap: spacing.md,
    marginTop: 'auto',
    paddingBottom: spacing.xl,
  },
  button: {
    width: '100%',
  },
});
