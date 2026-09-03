import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

export interface SelectableCardProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onSelect: () => void;
  multiSelect?: boolean;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  title,
  subtitle,
  icon,
  selected,
  onSelect,
  multiSelect = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.containerSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.contentRow}>
        {icon ? (
          <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
            <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.textMuted} />
          </View>
        ) : null}
        <View style={styles.textCol}>
          <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Ionicons
        name={selected ? (multiSelect ? 'checkbox' : 'radio-button-on') : (multiSelect ? 'square-outline' : 'radio-button-off')}
        size={24}
        color={selected ? colors.primary : colors.border}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  containerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.mintWash,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: colors.surface,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  titleSelected: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
