import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useConnectionStore } from '../stores/connectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useGameStore } from '../stores/gameStore';
import { Button, ConnectionStatus } from '../components/ui';

export default function HomeScreen() {
  const router = useRouter();
  
  // Connection state
  const connectionStatus = useConnectionStore((state) => state.status);
  const connect = useConnectionStore((state) => state.connect);
  
  // Settings state
  const threshold = useSettingsStore((state) => state.concentrationThreshold);
  
  // Game store - to set threshold
  const setGameThreshold = useGameStore((state) => state.setThreshold);
  
  const handleStartGame = () => {
    // Ensure game store has the current threshold
    setGameThreshold(threshold);
    router.push('/game');
  };
  
  const handleOpenSettings = () => {
    router.push('/settings');
  };
  
  const isConnected = connectionStatus === 'connected';
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Animated.View 
        entering={FadeInDown.delay(100).duration(500)}
        style={styles.header}
      >
        <ConnectionStatus 
          status={connectionStatus} 
          onReconnect={connect}
        />
        <Pressable
          style={({ pressed }) => [
            styles.settingsButton,
            pressed && styles.settingsButtonPressed,
          ]}
          onPress={handleOpenSettings}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </Animated.View>
      
      {/* Main content */}
      <View style={styles.content}>
        {/* Logo/Title */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(600)}
          style={styles.titleContainer}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="flash" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>EEG Racing</Text>
          <Text style={styles.subtitle}>Race with your mind</Text>
        </Animated.View>
        
        {/* Game mode card */}
        <Animated.View 
          entering={FadeInUp.delay(400).duration(600)}
          style={styles.modeCard}
        >
          <View style={styles.modeHeader}>
            <Ionicons name="person" size={24} color={colors.primary} />
            <Text style={styles.modeTitle}>Single Player</Text>
          </View>
          <Text style={styles.modeDescription}>
            Race against yourself. Focus your mind to advance your car and complete the track.
          </Text>
          <View style={styles.modeStats}>
            <View style={styles.modeStat}>
              <Text style={styles.modeStatValue}>{threshold}</Text>
              <Text style={styles.modeStatLabel}>Focus streak</Text>
            </View>
            <View style={styles.modeStat}>
              <Text style={styles.modeStatValue}>20</Text>
              <Text style={styles.modeStatLabel}>Track units</Text>
            </View>
          </View>
        </Animated.View>
        
        {/* Start button */}
        <Animated.View 
          entering={FadeInUp.delay(600).duration(600)}
          style={styles.buttonContainer}
        >
          <Button
            title={isConnected ? "Start Race" : "Connecting..."}
            onPress={handleStartGame}
            variant="primary"
            size="lg"
            disabled={!isConnected}
            style={styles.startButton}
          />
          
          {!isConnected && (
            <Text style={styles.connectionHint}>
              Waiting for server connection...
            </Text>
          )}
        </Animated.View>
      </View>
      
      {/* Footer */}
      <Animated.View 
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.footer}
      >
        <Text style={styles.footerText}>
          Focus your mind. Control your car. Win the race.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: {
    fontSize: typography.fontSizes['4xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.lg,
    color: colors.textSecondary,
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  modeDescription: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  modeStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  modeStat: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  modeStatValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  modeStatLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  startButton: {
    width: '100%',
    maxWidth: 300,
  },
  connectionHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
