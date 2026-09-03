import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';

export interface IdentityChipProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const IdentityChip: React.FC<IdentityChipProps> = ({
  label,
  value,
  icon,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      <Text style={styles.label}>{label}: </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintWash,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
  },
  iconSlot: {
    marginRight: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  value: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
});
