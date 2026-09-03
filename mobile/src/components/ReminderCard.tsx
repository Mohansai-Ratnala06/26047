import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Card } from './Card';
import { Badge } from './Badge';

export interface ReminderCardProps {
  title: string;
  time: string;
  category: string;
  status?: 'pending' | 'completed';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  title,
  time,
  category,
  status = 'pending',
  onPress,
  style,
}) => {
  return (
    <Card onPress={onPress} style={[styles.card, style]}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={status === 'completed' ? 'checkmark-circle' : 'time-outline'}
            size={20}
            color={status === 'completed' ? colors.success : colors.primary}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {category} • {time}
          </Text>
        </View>
        <Badge
          label={status === 'completed' ? 'Done' : 'Upcoming'}
          variant={status === 'completed' ? 'success' : 'mint'}
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
