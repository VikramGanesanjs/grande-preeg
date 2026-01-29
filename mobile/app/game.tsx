import React, { useEffect, useCallback } from 'react';
import { StyleSheet, View, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/theme';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { RaceTrack, ConcentrationMeter, GameHUD, Countdown } from '../components/game';

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
  } = useGameStore();
  
  // Settings
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  
  // Track previous advances for haptic feedback
  const prevAdvancesRef = React.useRef(totalAdvances);
  
  // Start game on mount
  useEffect(() => {
    startGame();
    
    return () => {
      // Clean up on unmount
      if (status === 'playing' || status === 'paused') {
        endGame();
      }
    };
  }, []);
  
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
        router.replace('/results');
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
});
