import React, { useEffect, useCallback, useState } from 'react';
import { StyleSheet, View, BackHandler, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '../../constants/theme';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { RaceTrack, ConcentrationMeter, GameHUD, Countdown } from '../../components/game';

export default function GameScreen() {
  const router = useRouter();
  
  // Game state
  const {
    status,
    carPosition,
    currentSignal,
    concentrationStreak,
    threshold,
    totalAdvances,
    elapsedTime,
    countdown,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    rawEegData,
    rawEegAverage,
    alphaPower,
    betaPower,
    powerSum,
    opponentPosition,
    opponentStatus,
    isMultiplayer,
    isLocalReady,
    isOpponentReady,
    setLocalReady,
  } = useGameStore();
  
  // Track if we're in lobby mode (multiplayer waiting for both players)
  const [inLobby, setInLobby] = useState(isMultiplayer);
  
  // Settings
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const devModeEnabled = useSettingsStore((state) => state.devModeEnabled);

  // Debug logging for multiplayer state
  useEffect(() => {
    console.log('[Game] Multiplayer state:', { isMultiplayer, opponentStatus, opponentPosition, inLobby });
  }, [isMultiplayer, opponentStatus, opponentPosition, inLobby]);
  
  // Track previous advances for haptic feedback
  const prevAdvancesRef = React.useRef(totalAdvances);
  
  // Start game on mount (if not multiplayer) or when both players ready (if multiplayer)
  useEffect(() => {
    if (!isMultiplayer) {
      // Single player - start immediately
      startGame();
    }
    
    return () => {
      // Clean up on unmount
      if (status === 'playing' || status === 'paused') {
        endGame();
      }
      // Reset ready state when leaving
      if (isMultiplayer) {
        setLocalReady(false);
      }
    };
  }, []);

  // Auto-start when both players are ready in multiplayer
  useEffect(() => {
    if (isMultiplayer && inLobby && isLocalReady && isOpponentReady) {
      // Both players ready - start the game!
      setInLobby(false);
      startGame();
    }
  }, [isMultiplayer, inLobby, isLocalReady, isOpponentReady, startGame]);

  // Handle ready button press
  const handleReadyPress = useCallback(() => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLocalReady(!isLocalReady);
  }, [hapticsEnabled, isLocalReady, setLocalReady]);
  
  // Haptic feedback when car advances
  useEffect(() => {
    if (totalAdvances > prevAdvancesRef.current && hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    prevAdvancesRef.current = totalAdvances;
  }, [totalAdvances, hapticsEnabled]);
  
  // Navigate to results when game finishes
  useEffect(() => {
    if (status === 'finished') {
      // Small delay for the finish animation
      const timer = setTimeout(() => {
        router.replace('/racing/results');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);
  
  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (status === 'playing') {
        pauseGame();
        return true;
      }
      return false;
    });
    
    return () => backHandler.remove();
  }, [status, pauseGame]);
  
  const handlePause = useCallback(() => {
    pauseGame();
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [pauseGame, hapticsEnabled]);
  
  const handleResume = useCallback(() => {
    resumeGame();
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [resumeGame, hapticsEnabled]);
  
  const isConcentrated = currentSignal === 'Concentrated';
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Multiplayer Lobby overlay */}
      {isMultiplayer && inLobby && (
        <View style={styles.lobbyOverlay}>
          <View style={styles.lobbyContent}>
            <Text style={styles.lobbyTitle}>Multiplayer Race</Text>
            <Text style={styles.lobbySubtitle}>Waiting for both players to be ready</Text>
            
            <View style={styles.lobbyPlayers}>
              {/* Local player status */}
              <View style={styles.lobbyPlayer}>
                <View style={[styles.lobbyStatusDot, isLocalReady && styles.lobbyStatusReady]} />
                <Text style={styles.lobbyPlayerLabel}>You</Text>
                <Text style={styles.lobbyPlayerStatus}>
                  {isLocalReady ? 'Ready!' : 'Not Ready'}
                </Text>
              </View>
              
              {/* Opponent status */}
              <View style={styles.lobbyPlayer}>
                <View style={[styles.lobbyStatusDot, isOpponentReady && styles.lobbyStatusReady]} />
                <Text style={styles.lobbyPlayerLabel}>Opponent</Text>
                <Text style={styles.lobbyPlayerStatus}>
                  {opponentStatus === 'disconnected' ? 'Disconnected' : 
                   isOpponentReady ? 'Ready!' : 'Not Ready'}
                </Text>
              </View>
            </View>
            
            {/* Ready button */}
            <TouchableOpacity
              style={[styles.readyButton, isLocalReady && styles.readyButtonActive]}
              onPress={handleReadyPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.readyButtonText, isLocalReady && styles.readyButtonTextActive]}>
                {isLocalReady ? 'Cancel Ready' : 'Ready!'}
              </Text>
            </TouchableOpacity>
            
            {/* Waiting indicator when both not ready yet */}
            {isLocalReady && !isOpponentReady && (
              <View style={styles.waitingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.waitingText}>Waiting for opponent...</Text>
              </View>
            )}
          </View>
        </View>
      )}
      
      {/* Countdown overlay */}
      {status === 'countdown' && <Countdown value={countdown} />}
      
      {/* Game HUD */}
      <GameHUD
        elapsedTime={elapsedTime}
        progress={carPosition}
        totalAdvances={totalAdvances}
        isPaused={status === 'paused'}
        onPause={handlePause}
        onResume={handleResume}
      />
      
      {/* Race Track */}
      <View style={styles.trackContainer}>
        <RaceTrack
          carPosition={carPosition}
          isConcentrated={isConcentrated}
          opponentPosition={opponentPosition}
          showOpponent={isMultiplayer && opponentStatus !== 'disconnected'}
        />
      </View>
      
      {/* Concentration Meter */}
      <View style={styles.meterContainer}>
        <ConcentrationMeter
          currentSignal={currentSignal}
          streak={concentrationStreak}
          threshold={threshold}
        />
      </View>
      
      {/* Paused overlay */}
      {status === 'paused' && (
        <View style={styles.pausedOverlay}>
          <View style={styles.pausedContent}>
            <View style={styles.pausedText}>
              <View style={styles.pausedIcon} />
            </View>
          </View>
        </View>
      )}
      
      {/* Dev Mode Overlay */}
      {devModeEnabled && (
        <View style={styles.devModeOverlay}>
          <View style={styles.devModeHeader}>
            <Text style={styles.devModeTitle}>DEV MODE</Text>
            <Text style={styles.devModeRule}>16 {'<'} sum {'<'} 60 = focused</Text>
          </View>
          <View style={styles.devModeSumRow}>
            <Text style={styles.devModeSumLabel}>Sum (α+β):</Text>
            <Text style={[
              styles.devModeSumValue, 
              powerSum !== null && powerSum > 16 && powerSum < 60 && styles.devModeValueActive
            ]}>
              {powerSum !== null ? powerSum.toFixed(2) : 'N/A'}
            </Text>
            <Text style={[styles.devModeSignal, isConcentrated && styles.devModeValueActive]}>
              {isConcentrated ? '● FOCUSED' : '○ UNFOCUSED'}
            </Text>
          </View>
          <View style={styles.devModeGrid}>
            <View style={styles.devModeColumn}>
              <View style={styles.devModeRow}>
                <Text style={styles.devModeLabel}>Alpha:</Text>
                <Text style={styles.devModeValue}>
                  {alphaPower !== null ? alphaPower.toFixed(2) : 'N/A'}
                </Text>
              </View>
              <View style={styles.devModeRow}>
                <Text style={styles.devModeLabel}>Beta:</Text>
                <Text style={styles.devModeValue}>
                  {betaPower !== null ? betaPower.toFixed(2) : 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.devModeColumn}>
              <View style={styles.devModeRow}>
                <Text style={styles.devModeLabel}>Avg:</Text>
                <Text style={styles.devModeValue}>
                  {rawEegAverage !== null ? rawEegAverage.toFixed(1) : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  trackContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  meterContainer: {
    paddingBottom: 40,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  pausedContent: {
    alignItems: 'center',
  },
  pausedText: {
    alignItems: 'center',
  },
  pausedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
  },
  devModeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  devModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  devModeTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    letterSpacing: 1,
  },
  devModeRule: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  devModeSumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  devModeSumLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  devModeSumValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontFamily: 'monospace',
    marginLeft: spacing.xs,
    minWidth: 60,
  },
  devModeSignal: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textMuted,
    marginLeft: 'auto',
    fontFamily: 'monospace',
  },
  devModeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  devModeColumn: {
    flex: 1,
  },
  devModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  devModeLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    marginRight: spacing.xs,
    fontFamily: 'monospace',
    width: 50,
  },
  devModeValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontFamily: 'monospace',
  },
  devModeValueActive: {
    color: colors.concentrated,
  },
  // Multiplayer lobby styles
  lobbyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lobbyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  lobbyTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  lobbySubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  lobbyPlayers: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: spacing.xl,
  },
  lobbyPlayer: {
    alignItems: 'center',
    flex: 1,
  },
  lobbyStatusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginBottom: spacing.sm,
  },
  lobbyStatusReady: {
    backgroundColor: colors.concentrated,
    borderColor: colors.concentrated,
  },
  lobbyPlayerLabel: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  lobbyPlayerStatus: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  readyButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  readyButtonActive: {
    backgroundColor: colors.primary,
  },
  readyButtonText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  readyButtonTextActive: {
    color: colors.background,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waitingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
});
