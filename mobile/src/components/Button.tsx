import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
}) => {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = { ...styles.base };

    if (size === 'sm') {
      base = { ...base, minHeight: 36, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2 };
    } else if (size === 'lg') {
      base = { ...base, minHeight: 52, paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
    } else {
      base = { ...base, minHeight: 46, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg };
    }

    switch (variant) {
      case 'secondary':
        base = {
          ...base,
          backgroundColor: colors.mintWash,
          borderWidth: 1,
          borderColor: 'rgba(10, 77, 82, 0.12)',
        };
        break;
      case 'outline':
        base = {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        };
        break;
      case 'ghost':
        base = {
          ...base,
          backgroundColor: 'transparent',
        };
        break;
      case 'danger':
        base = {
          ...base,
          backgroundColor: colors.error,
        };
        break;
      case 'primary':
      default:
        base = {
          ...base,
          backgroundColor: colors.primary,
          ...shadows.soft,
        };
        break;
    }

    if (disabled || loading) {
      base = { ...base, opacity: 0.6 };
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let base: TextStyle = { ...styles.baseText };
    if (size === 'sm') base = { ...base, fontSize: typography.fontSize.xs };
    if (size === 'lg') base = { ...base, fontSize: typography.fontSize.md };

    if (variant === 'secondary') {
      base = { ...base, color: colors.primaryDark };
    } else if (variant === 'outline' || variant === 'ghost') {
      base = { ...base, color: colors.primary };
    }

    return base;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' || variant === 'secondary' ? colors.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.card,
    gap: spacing.xs + 2,
  },
  baseText: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.semiBold,
    fontSize: typography.fontSize.sm,
    letterSpacing: -0.1,
  },
});
