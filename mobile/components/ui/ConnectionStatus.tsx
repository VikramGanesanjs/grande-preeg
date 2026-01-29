import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { ConnectionStatus as ConnectionStatusType } from '../../types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  onReconnect?: () => void;
}

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
  const statusConfig = {
    connected: {
      color: colors.success,
      icon: 'checkmark-circle' as const,
      text: 'Connected',
    },
    connecting: {
      color: colors.warning,
      icon: 'sync' as const,
      text: 'Connecting...',
    },
    disconnected: {
      color: colors.textMuted,
      icon: 'cloud-offline' as const,
      text: 'Disconnected',
    },
    error: {
      color: colors.error,
      icon: 'alert-circle' as const,
      text: 'Connection Error',
    },
  };

  const config = statusConfig[status];

  // Pulsing animation for connecting state
  const pulseStyle = useAnimatedStyle(() => {
    if (status === 'connecting') {
      return {
        opacity: withRepeat(
          withSequence(
            withTiming(0.4, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1,
          true
        ),
      };
    }
    return { opacity: 1 };
  }, [status]);

  // Scale animation for the dot
  const dotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(status === 'connected' ? 1 : 0.8, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [status]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.indicator, pulseStyle]}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: config.color },
            dotStyle,
          ]}
        />
        <Ionicons name={config.icon} size={16} color={config.color} />
        <Text style={[styles.text, { color: config.color }]}>
          {config.text}
        </Text>
      </Animated.View>

      {(status === 'disconnected' || status === 'error') && onReconnect && (
        <Pressable
          style={({ pressed }) => [
            styles.reconnectButton,
            pressed && styles.reconnectButtonPressed,
          ]}
          onPress={onReconnect}
        >
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.reconnectText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  reconnectButtonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  reconnectText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
});
