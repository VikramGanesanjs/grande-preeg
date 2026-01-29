import { useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import * as Haptics from 'expo-haptics';

/**
 * Custom hook for managing game state and side effects
 */
export function useGame() {
  const gameState = useGameStore();
  const settings = useSettingsStore();
  
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
    resetGame,
    getResults,
  } = gameState;
  
  const { hapticsEnabled, soundEnabled } = settings;
  
  // Derived state
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isFinished = status === 'finished';
  const isCountdown = status === 'countdown';
  const isConcentrated = currentSignal === 'Concentrated';
  const progress = carPosition;
  
  // Haptic feedback helper
  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
      if (!hapticsEnabled) return;
      
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    },
    [hapticsEnabled]
  );
  
  // Enhanced actions with haptics
  const handleStartGame = useCallback(() => {
    triggerHaptic('light');
    startGame();
  }, [startGame, triggerHaptic]);
  
  const handlePauseGame = useCallback(() => {
    triggerHaptic('light');
    pauseGame();
  }, [pauseGame, triggerHaptic]);
  
  const handleResumeGame = useCallback(() => {
    triggerHaptic('light');
    resumeGame();
  }, [resumeGame, triggerHaptic]);
  
  const handleEndGame = useCallback(() => {
    triggerHaptic('warning');
    endGame();
  }, [endGame, triggerHaptic]);
  
  return {
    // State
    status,
    carPosition,
    currentSignal,
    concentrationStreak,
    threshold,
    totalAdvances,
    elapsedTime,
    countdown,
    
    // Derived state
    isPlaying,
    isPaused,
    isFinished,
    isCountdown,
    isConcentrated,
    progress,
    
    // Actions
    startGame: handleStartGame,
    pauseGame: handlePauseGame,
    resumeGame: handleResumeGame,
    endGame: handleEndGame,
    resetGame,
    getResults,
    
    // Helpers
    triggerHaptic,
    
    // Settings
    hapticsEnabled,
    soundEnabled,
  };
}
