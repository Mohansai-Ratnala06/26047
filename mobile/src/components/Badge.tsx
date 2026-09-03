import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';

export type BadgeVariant = 'mint' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'mint',
  size = 'md',
  style,
}) => {
  const getBadgeTheme = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successLight, text: colors.success, border: colors.success };
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning, border: colors.warning };
      case 'error':
        return { bg: colors.errorLight, text: colors.error, border: colors.error };
      case 'info':
        return { bg: colors.infoLight, text: colors.info, border: colors.info };
      case 'neutral':
        return { bg: colors.surfaceSubtle, text: colors.textSecondary, border: colors.border };
      case 'mint':
      default:
        return { bg: colors.mintWash, text: colors.primaryDark, border: 'rgba(10, 77, 82, 0.2)' };
    }
  };

  const current = getBadgeTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
          paddingVertical: size === 'sm' ? 2 : spacing.xs,
          paddingHorizontal: size === 'sm' ? spacing.xs + 2 : spacing.sm + 2,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: current.text,
            fontSize: size === 'sm' ? typography.fontSize.xs - 2 : typography.fontSize.xs,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.2,
  },
});
