import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';

export interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({
  label,
  active = false,
  onPress,
  style,
  icon,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.container,
        active ? styles.activeContainer : styles.inactiveContainer,
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.text, active ? styles.activeText : styles.inactiveText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    gap: spacing.xs,
    borderWidth: 1,
  },
  activeContainer: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  inactiveContainer: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderSubtle,
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  activeText: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  inactiveText: {
    color: colors.textSecondary,
  },
});
