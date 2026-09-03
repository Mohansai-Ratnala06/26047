import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconEdit } from '@tabler/icons-react-native';
import { colors, typography } from '../../theme';

interface SectionCardProps {
  title: string;
  onEditPress: () => void;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, onEditPress, children }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onEditPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconEdit size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceSubtle,
  },
  title: {
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  content: {
    padding: 16,
  },
});
