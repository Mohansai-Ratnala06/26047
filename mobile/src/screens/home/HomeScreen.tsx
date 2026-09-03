import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  Card,
  GlassCard,
  Avatar,
  IconButton,
  IdentityChip,
  ReminderCard,
  AIActionButton,
  SectionHeader,
  Badge,
} from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();

  return (
    <ScreenContainer scrollable hasBottomTabs>
      {/* 1. Header with Avatar & Notification Control */}
      <View style={styles.topHeader}>
        <View style={styles.userRow}>
          <Avatar name={user?.name || ''} size="md" />
          <View style={styles.userTextCol}>
            <Text style={styles.greetingSubtitle}>Welcome to Vaidyaarc</Text>
            <Text style={styles.greetingName}>{user?.name}</Text>
          </View>
        </View>

        <View style={styles.notificationWrapper}>
          <IconButton
            icon={<Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />}
            onPress={() => {}}
            accessibilityLabel="Notifications"
            variant="surface"
          />
          <View style={styles.notificationDot} />
        </View>
      </View>

      {/* 2. Hero & Tagline */}
      <View style={styles.heroBox}>
        <Text style={styles.heroTagline}>Intelligent Healthcare Ecosystem</Text>
        <Text style={styles.heroDescription}>
          Unified medical intelligence and digital health services at your fingertips.
        </Text>
      </View>

      {/* 3. Digital Health Card Placeholder */}
      <GlassCard tint="mint" style={styles.digitalHealthCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardBrandRow}>
            <Ionicons name="card" size={20} color={colors.primary} />
            <Text style={styles.cardBrandTitle}>Digital Health Card</Text>
          </View>
          <Badge label="ABDM Active" variant="mint" size="sm" />
        </View>

        <View style={styles.cardBodyRow}>
          <View style={styles.cardInfoCol}>
            <Text style={styles.cardHolderLabel}>HEALTH CARD HOLDER</Text>
            <Text style={styles.cardHolderName}>{user?.name}</Text>
            <Text style={styles.cardAbha}>{user?.abhaId || 'Pending ABHA ID'}</Text>
          </View>
          <View style={styles.qrPlaceholder}>
            <Ionicons name="qr-code-outline" size={36} color={colors.primaryDark} />
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          <Text style={styles.cardSecureMeta}>Secure Health Profile Verified</Text>
          <Text style={styles.cardExpiry}>Valid: Permanent</Text>
        </View>
      </GlassCard>

      {/* 4. AI / Voice Entry Action Button */}
      <AIActionButton
        title="Speak with VaidyaAI"
        subtitle="Voice assistant for healthcare navigation & reminders"
        onPress={() => navigation.navigate('VoiceAgent')}
        style={styles.aiEntryBtn}
      />

      {/* 5. Reminder Card Section */}
      <SectionHeader title="Today's Reminders" />
      <ReminderCard
        title="Log Morning Vitals & Hydration"
        category="Daily Wellness"
        time="9:00 AM"
        status="completed"
      />
      <ReminderCard
        title="Check Health Records Update"
        category="Clinical Records"
        time="4:30 PM"
        status="pending"
        onPress={() => navigation.navigate('Records')}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userTextCol: {},
  greetingSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  greetingName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mintAccent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  heroBox: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroTagline: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: typography.lineHeight.xs,
  },
  digitalHealthCard: {
    marginBottom: spacing.md,
    borderColor: 'rgba(10, 77, 82, 0.18)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardBrandTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardInfoCol: {
    flex: 1,
  },
  cardHolderLabel: {
    fontSize: 9,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  cardHolderName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  cardAbha: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.semiBold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  qrPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.08)',
  },
  cardSecureMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  cardExpiry: {
    fontSize: 10,
    color: colors.textMuted,
  },
  aiEntryBtn: {
    marginVertical: spacing.xs,
  },
});
