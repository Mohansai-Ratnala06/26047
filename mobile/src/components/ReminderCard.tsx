import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Card } from './Card';
import { Badge } from './Badge';

import { useTranslation } from '../i18n';

export interface ReminderCardProps {
  title: string;
  time: string;
  category: string;
  status?: 'pending' | 'completed';
  statusLabel?: string;
  badgeVariant?: 'mint' | 'success' | 'warning' | 'error' | 'neutral';
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  title,
  time,
  category,
  status = 'pending',
  statusLabel,
  badgeVariant,
  iconName,
  iconColor,
  onPress,
  style,
}) => {
  const { t } = useTranslation();
  const badgeLabel = statusLabel || (status === 'completed' ? t('common.done') : t('common.upcoming'));
  const effectiveVariant = badgeVariant || (status === 'completed' ? 'success' : 'mint');
  const effectiveIconName = iconName || (status === 'completed' ? 'checkmark-circle' : 'time-outline');
  const effectiveIconColor = iconColor || (status === 'completed' ? colors.success : colors.primary);

  return (
    <Card onPress={onPress} style={[styles.card, style]}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={effectiveIconName}
            size={20}
            color={effectiveIconColor}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {category} • {time}
          </Text>
        </View>
        <Badge
          label={badgeLabel}
          variant={effectiveVariant}
          size="sm"
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
