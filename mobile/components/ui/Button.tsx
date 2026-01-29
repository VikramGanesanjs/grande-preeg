import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const variantStyles = {
    primary: {
      container: styles.primaryContainer,
      text: styles.primaryText,
    },
    secondary: {
      container: styles.secondaryContainer,
      text: styles.secondaryText,
    },
    outline: {
      container: styles.outlineContainer,
      text: styles.outlineText,
    },
    ghost: {
      container: styles.ghostContainer,
      text: styles.ghostText,
    },
  };

  const sizeStyles = {
    sm: {
      container: styles.smContainer,
      text: styles.smText,
    },
    md: {
      container: styles.mdContainer,
      text: styles.mdText,
    },
    lg: {
      container: styles.lgContainer,
      text: styles.lgText,
    },
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.container,
        variantStyles[variant].container,
        sizeStyles[size].container,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variantStyles[variant].text,
          sizeStyles[size].text,
          disabled && styles.disabledText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.fontWeights.semibold,
    textAlign: 'center',
  },
  
  // Variants
  primaryContainer: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.text,
  },
  secondaryContainer: {
    backgroundColor: colors.secondary,
  },
  secondaryText: {
    color: colors.text,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.textSecondary,
  },

  // Sizes
  smContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smText: {
    fontSize: typography.fontSizes.sm,
  },
  mdContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  mdText: {
    fontSize: typography.fontSizes.md,
  },
  lgContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  lgText: {
    fontSize: typography.fontSizes.lg,
  },

  // States
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});
