import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useConnectionStore } from '../stores/connectionStore';
import { ConnectionStatus } from '../components/ui';

interface GameCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress: () => void;
  delay: number;
  available: boolean;
}

function GameCard({ title, subtitle, description, icon, iconColor, onPress, delay, available }: GameCardProps) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)}>
      <Pressable
        style={({ pressed }) => [
          styles.gameCard,
          pressed && styles.gameCardPressed,
          !available && styles.gameCardDisabled,
        ]}
        onPress={available ? onPress : undefined}
        disabled={!available}
      >
        <View style={[styles.gameIconContainer, { borderColor: iconColor }]}>
          <Ionicons name={icon} size={32} color={iconColor} />
        </View>
        <View style={styles.gameCardContent}>
          <View style={styles.gameCardHeader}>
            <Text style={styles.gameCardTitle}>{title}</Text>
            {!available && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}
          </View>
          <Text style={styles.gameCardSubtitle}>{subtitle}</Text>
          <Text style={styles.gameCardDescription}>{description}</Text>
        </View>
        {available && (
          <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function GameSelectorScreen() {
  const router = useRouter();
  
  // Connection state
  const connectionStatus = useConnectionStore((state) => state.status);
  const connect = useConnectionStore((state) => state.connect);
  
  const handleOpenSettings = () => {
    router.push('/settings');
  };
  
  const handleSelectRacing = () => {
    router.push('/racing');
  };
  
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
      
      {/* Title */}
      <Animated.View 
        entering={FadeInUp.delay(200).duration(600)}
        style={styles.titleContainer}
      >
        <View style={styles.logoContainer}>
          <Ionicons name="flash" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>EEG Games</Text>
        <Text style={styles.subtitle}>Train your brain with fun games</Text>
      </Animated.View>
      
      {/* Games list */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GameCard
          title="EEG Racing"
          subtitle="Race with your mind"
          description="Control your car through mental focus. Build concentration streaks to advance along the track."
          icon="car-sport"
          iconColor={colors.primary}
          onPress={handleSelectRacing}
          delay={400}
          available={true}
        />

        <GameCard
          title="NeuroJack"
          subtitle="SSVEP Slapjack BCI"
          description="Watch the cards flicker. When a Jack appears, shift your gaze to the SLAP button to trigger it with your brain."
          icon="hand-right-outline"
          iconColor="#ff1a1a"
          onPress={() => router.push('/slapjack/game')}
          delay={500}
          available={true}
        />
        
        <GameCard
          title="Focus Flow"
          subtitle="Rhythm meets mindfulness"
          description="Match your concentration to the rhythm. Stay focused to keep the flow going."
          icon="musical-notes"
          iconColor={colors.secondary}
          onPress={() => {}}
          delay={500}
          available={false}
        />
        
        <GameCard
          title="Mind Garden"
          subtitle="Grow with your focus"
          description="Plant and nurture a virtual garden. Your concentration helps your plants flourish."
          icon="leaf"
          iconColor={colors.concentrated}
          onPress={() => {}}
          delay={600}
          available={false}
        />
        
        <GameCard
          title="Zen Puzzle"
          subtitle="Calm your mind, solve puzzles"
          description="Relaxing puzzles that respond to your mental state. Focus to reveal solutions."
          icon="grid"
          iconColor={colors.warning}
          onPress={() => {}}
          delay={700}
          available={false}
        />
      </ScrollView>
      
      {/* Footer */}
      <Animated.View 
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.footer}
      >
        <Text style={styles.footerText}>
          Connect your EEG device and start training
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
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  gameCardPressed: {
    backgroundColor: colors.surfaceLight,
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: spacing.md,
  },
  gameCardContent: {
    flex: 1,
  },
  gameCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  gameCardTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  comingSoonBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  comingSoonText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  gameCardSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  gameCardDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
