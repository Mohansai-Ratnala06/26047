import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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
  LanguageToggle,
} from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { t, getGreeting } = useTranslation();
  const displayName = user?.name || 'Abhitha';
  const greetingInfo = getGreeting(displayName);

  return (
    <ScreenContainer scrollable hasBottomTabs>
      {/* 1. Header with Avatar, Dynamic Time-of-Day Greeting, Language Toggle & Notification Control */}
      <View style={styles.topHeader}>
        <View style={styles.userRow}>
          <Avatar name={displayName} size="md" />
          <View style={styles.userTextCol}>
            <Text style={styles.greetingSubtitle}>{greetingInfo.greeting}</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
          </View>
        </View>

        <View style={styles.headerRightRow}>
          {/* Top Language Toggle Pill with Globe Icon beside Notification Icon */}
          <LanguageToggle />

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
      </View>

      {/* 2. Hero & Tagline */}
      <View style={styles.heroBox}>
        <Text style={styles.heroTagline}>{t('home.heroTagline')}</Text>
        <Text style={styles.heroDescription}>
          {t('home.heroDescription')}
        </Text>
      </View>

      {/* 3. Digital Health Card Placeholder */}
      <GlassCard tint="mint" style={styles.digitalHealthCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardBrandRow}>
            <Image
              source={require('../../../assets/logo-mark.png')}
              style={{ width: 22, height: 22, marginRight: 8 }}
              resizeMode="contain"
            />
            <Text style={styles.cardBrandTitle}>{t('home.digitalHealthCard')}</Text>
          </View>
          <Badge label={t('home.abdmActive')} variant="mint" size="sm" />
        </View>

        <View style={styles.cardBodyRow}>
          <View style={styles.cardInfoCol}>
            <Text style={styles.cardHolderLabel}>{t('home.healthCardHolder')}</Text>
            <Text style={styles.cardHolderName}>{displayName}</Text>
            <Text style={styles.cardAbha}>{user?.abhaId || t('home.pendingAbhaId')}</Text>
          </View>
          <View style={styles.qrPlaceholder}>
            <Ionicons name="qr-code-outline" size={36} color={colors.primaryDark} />
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          <Text style={styles.cardSecureMeta}>{t('home.secureProfileVerified')}</Text>
          <Text style={styles.cardExpiry}>{t('home.validPermanent')}</Text>
        </View>
      </GlassCard>

      {/* 4. AI / Voice Entry Action Button */}
      <AIActionButton
        title={t('home.speakWithAi')}
        subtitle={t('home.aiSubtitle')}
        onPress={() => navigation.navigate('VoiceAgent')}
        style={styles.aiEntryBtn}
      />

      {/* 5. Reminder Card Section */}
      <SectionHeader title={t('home.todaysReminders')} />
      <ReminderCard
        title={t('home.morningVitalsTitle')}
        category={t('home.morningVitalsCategory')}
        time="9:00 AM"
        status="completed"
      />
      <ReminderCard
        title={t('home.checkRecordsTitle')}
        category={t('home.checkRecordsCategory')}
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
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
