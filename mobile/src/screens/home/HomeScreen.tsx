import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
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
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n';
import { DocumentUploadWorkflowModal } from '../records/upload/DocumentUploadWorkflowModal';

interface GovtScheme {
  id: string;
  name: string;
  badge: string;
  badgeVariant: 'mint' | 'success' | 'warning' | 'neutral';
  icon: keyof typeof Ionicons.glyphMap;
  ministry: string;
  description: string;
  url: string;
}

const GOVT_SCHEMES: GovtScheme[] = [
  {
    id: 'pmjay',
    name: 'Ayushman Bharat PM-JAY',
    badge: '₹5 Lakh Cover',
    badgeVariant: 'mint',
    icon: 'shield-checkmark-outline',
    ministry: 'National Health Authority (NHA)',
    description: 'Cashless hospitalisation cover of up to ₹5,00,000 per family per year for secondary & tertiary healthcare across all empanelled hospitals.',
    url: 'https://pmjay.gov.in/',
  },
  {
    id: 'abdm',
    name: 'ABHA - Digital Health ID',
    badge: 'Digital Health',
    badgeVariant: 'mint',
    icon: 'card-outline',
    ministry: 'Ministry of Health & Family Welfare',
    description: 'Create and manage your 14-digit national ABHA account to seamlessly link, access, and share your verifiable health records nationwide.',
    url: 'https://abdm.gov.in/',
  },
  {
    id: 'pmbjp',
    name: 'PM Janaushadhi Pariyojana',
    badge: '50-90% Cheaper',
    badgeVariant: 'mint',
    icon: 'medkit-outline',
    ministry: 'Dept of Pharmaceuticals, Govt of India',
    description: 'High-quality generic medicines, surgical items, and healthcare essentials accessible at dramatically lower prices through Janaushadhi Kendras.',
    url: 'https://janaushadhi.gov.in/',
  },
  {
    id: 'esanjeevani',
    name: 'eSanjeevani Teleconsultation',
    badge: 'Free Doctor OPD',
    badgeVariant: 'mint',
    icon: 'videocam-outline',
    ministry: 'MoHFW, Government of India',
    description: 'Free national telemedicine service connecting citizens with verified government doctors for digital consultations and instant e-prescriptions.',
    url: 'https://esanjeevani.mohfw.gov.in/',
  },
  {
    id: 'pmmvy',
    name: 'PM Matru Vandana Yojana',
    badge: '₹5,000 Maternity Aid',
    badgeVariant: 'mint',
    icon: 'heart-outline',
    ministry: 'Ministry of Women & Child Development',
    description: 'Direct maternity cash benefit of ₹5,000 for pregnant women and lactating mothers for essential clinical check-ups and nutritional aid.',
    url: 'https://pmmvy.wcd.gov.in/',
  },
  {
    id: 'npy',
    name: 'Nikshay Poshan Scheme',
    badge: 'TB Patient Support',
    badgeVariant: 'mint',
    icon: 'nutrition-outline',
    ministry: 'Central TB Division, MoHFW',
    description: 'Direct cash benefit of ₹500/month for nutritional support provided to all registered tuberculosis patients during their clinical treatment.',
    url: 'https://tbcindia.gov.in/',
  },
];

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { t, getGreeting } = useTranslation();
  const displayName = user?.name || 'Abhitha';
  const greetingInfo = getGreeting(displayName);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const handleOpenScheme = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (_) {
      // Fallback
    }
  };

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

      {/* 5. Health Actions & Reminders */}
      <SectionHeader title={t('home.todaysReminders')} />
      
      {/* Action 1: Update Your Health Profile */}
      <ReminderCard
        title={t('home.updateProfileTitle')}
        category={t('home.updateProfileCategory')}
        time="Action Required"
        status="pending"
        statusLabel="Update"
        badgeVariant="warning"
        iconName="person-circle-outline"
        iconColor="#D97706"
        onPress={() => navigation.navigate('Profile')}
      />

      {/* Action 2: Upload Health Records */}
      <ReminderCard
        title={t('home.uploadDocumentsTitle')}
        category={t('home.uploadDocumentsCategory')}
        time="Smart AI Scan"
        status="pending"
        statusLabel="Upload"
        badgeVariant="mint"
        iconName="cloud-upload-outline"
        iconColor={colors.primary}
        onPress={() => setUploadModalVisible(true)}
      />

      {/* 6. Government Health Schemes (Horizontal Sliding Cards) */}
      <SectionHeader
        title={t('home.govtSchemesTitle')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.schemesScrollContent}
        style={styles.schemesScrollView}
      >
        {GOVT_SCHEMES.map((scheme) => (
          <TouchableOpacity
            key={scheme.id}
            activeOpacity={0.88}
            onPress={() => handleOpenScheme(scheme.url)}
            style={styles.schemeCard}
            accessibilityRole="link"
            accessibilityLabel={`Open ${scheme.name} official website in browser`}
          >
            <View style={styles.schemeCardTopRow}>
              <View style={styles.schemeIconCircle}>
                <Ionicons name={scheme.icon} size={20} color={colors.primary} />
              </View>
              <Badge label={scheme.badge} variant={scheme.badgeVariant} size="sm" />
            </View>

            <Text style={styles.schemeTitle} numberOfLines={1}>
              {scheme.name}
            </Text>
            <Text style={styles.schemeMinistry} numberOfLines={1}>
              {scheme.ministry}
            </Text>
            <Text style={styles.schemeDescription} numberOfLines={3}>
              {scheme.description}
            </Text>

            <View style={styles.schemeCardFooter}>
              <Text style={styles.schemeLinkText}>{t('home.visitOfficialPortal')}</Text>
              <Ionicons name="open-outline" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 7. Bottom Credits & App Branding Footer */}
      <View style={styles.bottomCredits}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.creditsLogo}
          resizeMode="contain"
        />
        <Text style={styles.creditsTagline}>Intelligent Healthcare Ecosystem</Text>
        <Text style={styles.creditsMeta}>Ayushman Bharat Digital Mission (ABDM) Compliant</Text>
        <Text style={styles.creditsVersion}>Vaidyaarc v1.0.0</Text>
      </View>

      {/* Modal for Direct In-Home Document Upload */}
      <DocumentUploadWorkflowModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onUploadSuccess={() => {
          setUploadModalVisible(false);
          navigation.navigate('Records');
        }}
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
  schemesScrollView: {
    marginHorizontal: -spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  schemesScrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  schemeCard: {
    width: 270,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
    justifyContent: 'space-between',
  },
  schemeCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  schemeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemeTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  schemeMinistry: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  schemeDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  schemeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  schemeLinkText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  bottomCredits: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  creditsLogo: {
    width: 140,
    height: 48,
    marginBottom: spacing.xs,
  },
  creditsTagline: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  creditsMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  creditsVersion: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
    marginTop: 4,
  },
});
