import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

export interface ChipProps {
  label: string;
  role?: 'danger' | 'warning' | 'success' | 'brand' | 'neutral';
  solid?: boolean; // For when we need a solid badge rather than a soft chip
}

export const Chip: React.FC<ChipProps> = ({ label, role = 'neutral', solid = false }) => {
  let bg = colors.surfaceSubtle;
  let text = colors.textSecondary;

  switch (role) {
    case 'danger':
      bg = solid ? colors.dangerFill : colors.dangerBg;
      text = solid ? colors.dangerOn : colors.dangerText;
      break;
    case 'warning':
      bg = solid ? colors.warningFill : colors.warningBg;
      text = solid ? colors.warningOn : colors.warningText;
      break;
    case 'success':
      bg = solid ? colors.successFill : colors.successBg;
      text = solid ? colors.successOn : colors.successText;
      break;
    case 'brand':
      bg = solid ? colors.primary : colors.mintWash;
      text = solid ? colors.textOnPrimary : colors.primary;
      break;
    case 'neutral':
      bg = colors.surfaceSubtle;
      text = colors.textSecondary;
      break;
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
  },
});
