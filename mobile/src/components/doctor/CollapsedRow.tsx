import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconChevronDown } from '@tabler/icons-react-native';
import { colors, typography } from '../../theme';

interface CollapsedRowProps {
  title: string;
  onPress: () => void;
}

export const CollapsedRow: React.FC<CollapsedRowProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.title}>{title}</Text>
      <IconChevronDown size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  title: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
});
