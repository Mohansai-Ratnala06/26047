import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconAlertTriangle, IconCheck, IconClock } from '@tabler/icons-react-native';
import { colors, typography, shadows } from '../../theme';
import { Chip } from './Chip';

export interface PatientRowProps {
  token: string;
  name: string;
  age: number;
  gender: string;
  complaint: string;
  status: 'priority' | 'ready' | 'processing';
  onPress?: () => void;
}

export const PatientRow: React.FC<PatientRowProps> = ({ token, name, age, gender, complaint, status, onPress }) => {
  const isPriority = status === 'priority';
  const cardStyle = [styles.card, isPriority && styles.cardPriority];
  const textColor = isPriority ? colors.dangerText : colors.textPrimary;
  const subTextColor = isPriority ? colors.dangerText : colors.textSecondary;

  return (
    <TouchableOpacity style={cardStyle} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.tokenCircle, isPriority && styles.tokenCirclePriority]}>
        <Text style={[styles.tokenText, isPriority && styles.tokenTextPriority]}>{token}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: textColor }]}>{name}</Text>
          {isPriority && <Chip label="priority" role="danger" />}
        </View>
        <Text style={[styles.details, { color: subTextColor }]}>
          {age} · {gender}
        </Text>
        <Text style={[styles.complaint, { color: subTextColor }]} numberOfLines={1}>
          {complaint}
        </Text>
      </View>
      <View style={styles.trailing}>
        {status === 'priority' && <IconAlertTriangle color={colors.dangerText} size={20} />}
        {status === 'ready' && <IconCheck color={colors.successText} size={20} />}
        {status === 'processing' && <IconClock color={colors.textMuted} size={20} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  cardPriority: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBg,
  },
  tokenCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tokenCirclePriority: {
    backgroundColor: colors.dangerFill,
  },
  tokenText: {
    fontSize: 16,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  tokenTextPriority: {
    color: colors.dangerOn,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: typography.fontWeight.medium,
  },
  details: {
    fontSize: 12,
    marginBottom: 4,
  },
  complaint: {
    fontSize: 13,
  },
  trailing: {
    marginLeft: 12,
    justifyContent: 'center',
  },
});
