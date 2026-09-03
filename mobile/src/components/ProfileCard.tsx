import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { IdentityChip } from './IdentityChip';

export interface ProfileCardProps {
  name: string;
  abhaId?: string;
  email?: string;
  phone?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  abhaId,
  email,
  phone,
  style,
  children,
}) => {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Avatar name={name} size="lg" />
        <View style={styles.nameCol}>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.meta}>{email}</Text> : null}
          {phone ? <Text style={styles.meta}>{phone}</Text> : null}
        </View>
      </View>

      {abhaId ? (
        <View style={styles.chipRow}>
          <IdentityChip label="ABHA" value={abhaId} />
        </View>
      ) : null}

      {children ? <View style={styles.extensionContainer}>{children}</View> : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chipRow: {
    marginTop: spacing.md,
  },
  extensionContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
