import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

interface MetricCardProps {
  label: string;
  value: string;
  valueColor?: 'default' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, valueColor = 'default' }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor === 'danger' && styles.valueDanger]}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    padding: 10,
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  valueDanger: {
    color: colors.dangerText,
  },
});
