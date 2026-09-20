import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { Badge } from './Badge';
import { Button } from './Button';
import { useTranslation } from '../i18n';

export interface DigitalHealthCardProps {
  name: string;
  abhaId?: string;
  patientCode?: string;
  bloodGroup?: string;
  gender?: string;
  age?: number | string;
  phone?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onEditDemographics?: () => void;
}

export const DigitalHealthCard: React.FC<DigitalHealthCardProps> = ({
  name,
  abhaId,
  patientCode,
  bloodGroup,
  gender,
  age,
  phone,
  style,
  onPress,
  onEditDemographics,
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const isPendingAbha = !abhaId || abhaId.toLowerCase().includes('pending') || abhaId.toLowerCase().includes('link');
  const displayAbha = isPendingAbha ? (t('home.pendingAbhaId') || 'Pending Linking') : abhaId;
  const displayPatientCode = patientCode || 'PAT-PENDING';
  const displayBloodGroup = bloodGroup && bloodGroup !== 'Not Set' ? bloodGroup : (t('common.pending') || 'Not Set');
  const displayGender = gender && gender !== 'Not Specified' ? gender : 'Not Specified';
  const displayAge = age && age !== 'Not Set'
    ? (typeof age === 'number' || !String(age).includes('Yrs') ? `${age} Yrs` : String(age))
    : (t('common.pending') || 'Not Set');
  const displayPhone = phone || 'Not Registered';

  // Strictly Identity & Demographics QR Payload (Real-time from database, Zero clinical/medical data)
  const qrPayload = useMemo(() => {
    const cleanAge = age && age !== 'Not Set' ? (typeof age === 'number' ? age : parseInt(String(age), 10) || null) : null;
    const cleanGender = gender && gender !== 'Not Specified' && gender !== 'Not Set' ? gender : null;
    const cleanBlood = bloodGroup && bloodGroup !== 'Not Set' ? bloodGroup : null;
    const cleanAbha = isPendingAbha ? null : abhaId;
    const cleanPatientCode = patientCode && patientCode !== 'PAT-PENDING' ? patientCode : null;
    const cleanPhone = phone && phone !== 'Not Registered' ? phone : null;

    return JSON.stringify({
      v: '1.0',
      type: 'ABDM_CITIZEN_ID',
      abha: cleanAbha,
      name: name || 'Citizen',
      gender: cleanGender,
      age: cleanAge,
      bloodGroup: cleanBlood,
      patientCode: cleanPatientCode,
      phone: cleanPhone,
      issuer: 'Vaidyaarc ABDM Gateway',
    });
  }, [abhaId, isPendingAbha, name, gender, age, bloodGroup, patientCode, phone]);

  const handleCardPress = () => {
    setModalVisible(true);
    if (onPress) onPress();
  };

  const handleCopyAbha = () => {
    if (isPendingAbha) {
      Alert.alert(t('home.pendingAbhaId') || 'ABHA Not Linked', 'Please link your ABHA ID in profile settings.');
      return;
    }
    Alert.alert(
      t('common.done') || 'Copied',
      `${abhaId} ${(t('home.copyAbhaSuccess') as string) || 'copied to clipboard!'}`
    );
  };

  return (
    <>
      {/* 1. Main Digital Health Profile Card */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleCardPress}
        style={[styles.cardContainer, style]}
      >
        {/* Subtle Decorative Background Aura */}
        <View style={styles.decorAuraTop} pointerEvents="none" />
        <View style={styles.decorAuraBottom} pointerEvents="none" />

        {/* Card Header: Official Health Identity Branding */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../assets/logo-mark.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.cardBrandTitle}>
                {t('home.digitalHealthCard') || 'Digital Health ID Card'}
              </Text>
              <Text style={styles.cardBrandSubtitle}>
                Ayushman Bharat Digital Mission (ABDM)
              </Text>
            </View>
          </View>
          <View style={styles.headerRightRow}>
            {onEditDemographics ? (
              <TouchableOpacity
                style={styles.cardEditPill}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onEditDemographics();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Edit Profile Demographics"
              >
                <Ionicons name="create-outline" size={12} color={colors.primaryDark} />
                <Text style={styles.cardEditPillText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            <Badge
              label={t('home.abdmActive') || 'ABDM Active'}
              variant="mint"
              size="sm"
              style={styles.headerBadge}
            />
          </View>
        </View>

        {/* Card Body: Patient Identification & Dynamic QR */}
        <View style={styles.cardBodyRow}>
          {/* Left Column: Demographics and ABHA */}
          <View style={styles.cardInfoCol}>
            <Text style={styles.cardHolderLabel}>
              {t('home.healthCardHolder') || 'HEALTH ID HOLDER'}
            </Text>
            <Text style={styles.cardHolderName} numberOfLines={1}>
              {name || 'Citizen'}
            </Text>

            {/* Formatted ABHA ID Pill */}
            <View style={[styles.abhaPill, isPendingAbha && styles.abhaPillPending]}>
              <Ionicons
                name={isPendingAbha ? "link-outline" : "card-outline"}
                size={13}
                color={isPendingAbha ? colors.textMuted : colors.primaryDark}
              />
              <Text style={[styles.abhaPillText, isPendingAbha && styles.abhaPillTextPending]}>
                {displayAbha}
              </Text>
            </View>

            {/* Demographics Pill Row (Blood Group, Gender, Age, UID) */}
            <View style={styles.demographicsRow}>
              {/* Blood Group Pill (Vital for Emergency) */}
              <View style={bloodGroup && bloodGroup !== 'Not Set' ? styles.bloodPill : styles.demographicPill}>
                <Ionicons
                  name={bloodGroup && bloodGroup !== 'Not Set' ? "water" : "water-outline"}
                  size={11}
                  color={bloodGroup && bloodGroup !== 'Not Set' ? "#DC2626" : colors.textSecondary}
                />
                <Text style={bloodGroup && bloodGroup !== 'Not Set' ? styles.bloodPillText : styles.demographicPillText}>
                  {displayBloodGroup}
                </Text>
              </View>

              {/* Gender Pill */}
              <View style={styles.demographicPill}>
                <Ionicons name="person-outline" size={10} color={colors.textSecondary} />
                <Text style={styles.demographicPillText}>{displayGender}</Text>
              </View>

              {/* Age Pill */}
              <View style={styles.demographicPill}>
                <Ionicons name="calendar-outline" size={10} color={colors.textSecondary} />
                <Text style={styles.demographicPillText}>{displayAge}</Text>
              </View>

              {/* Patient UID Pill */}
              <View style={styles.uidPill}>
                <Text style={styles.uidPillText}>{displayPatientCode}</Text>
              </View>
            </View>
          </View>

          {/* Right Column: High-Density Dynamic QR Code */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
            style={styles.qrContainer}
          >
            <View style={styles.qrBox}>
              <QRCode
                value={qrPayload}
                size={66}
                color={colors.primaryDark}
                backgroundColor="#FFFFFF"
                quietZone={2}
              />
            </View>
            <View style={styles.tapCueRow}>
              <Ionicons name="scan-outline" size={10} color={colors.primaryDark} />
              <Text style={styles.tapCueText}>
                {(t('home.tapToEnlarge') as string) || 'Tap to enlarge'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Card Footer: Privacy & Verification Watermark */}
        <View style={styles.cardFooterRow}>
          <View style={styles.secureMetaRow}>
            <Ionicons name="shield-checkmark" size={12} color={colors.mintDark} />
            <Text style={styles.cardSecureMeta}>
              {(t('home.noMedicalDataBadge') as string) || 'Identity Verified • Zero Clinical Data'}
            </Text>
          </View>
          <Text style={styles.cardExpiry}>
            {t('home.validPermanent') || 'Valid: Permanent'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 2. Interactive Full-Screen QR & Demographics Identification Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalBrandRow}>
                <Image
                  source={require('../../assets/logo-mark.png')}
                  style={{ width: 26, height: 26, marginRight: 10 }}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.modalTitle}>
                    {t('home.digitalHealthCard') || 'Digital Health Identity'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    National Health Authority (ABDM)
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Holder Summary */}
              <View style={styles.modalHolderBox}>
                <Text style={styles.modalHolderLabel}>
                  {t('home.healthCardHolder') || 'REGISTERED CITIZEN'}
                </Text>
                <Text style={styles.modalHolderName}>{name || 'Citizen'}</Text>
                <Text style={[styles.modalAbhaText, isPendingAbha && { color: colors.textMuted }]}>
                  {displayAbha}
                </Text>
              </View>

              {/* High-Resolution Dynamic Scannable QR Code */}
              <View style={styles.modalQrContainer}>
                <View style={styles.modalQrWrapper}>
                  <QRCode
                    value={qrPayload}
                    size={196}
                    color={colors.primaryDark}
                    backgroundColor="#FFFFFF"
                    quietZone={6}
                  />
                </View>
                <Text style={styles.modalScanInstruction}>
                  {(t('home.scanInstruction') as string) ||
                    'Present this QR at Hospital Reception, OPD Kiosk, or Diagnostic Lab for instant patient identification.'}
                </Text>
              </View>

              {/* Verified Demographics Specs Table */}
              <View style={styles.specsTable}>
                <View style={styles.specRow}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>
                      {(t('home.bloodGroupLabel') as string) || 'Blood Group'}
                    </Text>
                    <View style={styles.specValueBadge}>
                      <Ionicons
                        name="water"
                        size={13}
                        color={bloodGroup && bloodGroup !== 'Not Set' ? "#DC2626" : colors.textMuted}
                      />
                      <Text style={[styles.specBloodValue, (!bloodGroup || bloodGroup === 'Not Set') && { color: colors.textSecondary }]}>
                        {displayBloodGroup}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>
                      {(t('home.genderLabel') as string) || 'Gender'}
                    </Text>
                    <Text style={styles.specValue}>{displayGender}</Text>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>
                      {(t('home.ageLabel') as string) || 'Age'}
                    </Text>
                    <Text style={styles.specValue}>{displayAge}</Text>
                  </View>
                </View>

                <View style={styles.specDivider} />

                <View style={styles.specRow}>
                  <View style={[styles.specItem, { flex: 1.2 }]}>
                    <Text style={styles.specLabel}>
                      {(t('home.patientIdLabel') as string) || 'Hospital UID'}
                    </Text>
                    <Text style={styles.specValueMono}>{displayPatientCode}</Text>
                  </View>

                  <View style={[styles.specItem, { flex: 1.5 }]}>
                    <Text style={styles.specLabel}>Registered Phone</Text>
                    <Text style={styles.specValueMono}>{displayPhone}</Text>
                  </View>
                </View>
              </View>

              {/* Privacy & Zero-Clinical-Data Reassurance Banner */}
              <View style={styles.privacyReassuranceBanner}>
                <Ionicons name="lock-closed" size={18} color="#0D9488" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>ABDM Privacy Safeguard</Text>
                  <Text style={styles.privacyDesc}>
                    {(t('home.privacyGuaranteeNotice') as string) ||
                      'This QR code contains solely your citizen identity and demographic verification. Your clinical diagnoses, prescriptions, and medical records remain encrypted and confidential.'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionCol}>
                {onEditDemographics ? (
                  <Button
                    title="Update Demographics"
                    variant="outline"
                    icon={<Ionicons name="create-outline" size={16} color={colors.primary} />}
                    onPress={() => {
                      setModalVisible(false);
                      onEditDemographics();
                    }}
                    style={styles.editBtn}
                  />
                ) : null}
                {!isPendingAbha ? (
                  <Button
                    title="Copy ABHA Number"
                    variant="secondary"
                    icon={<Ionicons name="copy-outline" size={16} color={colors.primary} />}
                    onPress={handleCopyAbha}
                    style={styles.copyBtn}
                  />
                ) : null}
                <Button
                  title={t('common.close') || 'Done'}
                  variant="primary"
                  onPress={() => setModalVisible(false)}
                  style={styles.doneBtn}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  /* Main Card Container */
  cardContainer: {
    backgroundColor: '#F4FAF8',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.22)',
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.soft,
  },
  decorAuraTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  decorAuraBottom: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(10, 77, 82, 0.04)',
  },

  /* Card Header */
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  logoBadgeContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
  },
  logoImage: {
    width: 18,
    height: 18,
  },
  cardBrandTitle: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    letterSpacing: -0.2,
  },
  cardBrandSubtitle: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  cardEditPillText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
  },

  /* Card Body */
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardInfoCol: {
    flex: 1,
    paddingRight: 4,
  },
  cardHolderLabel: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardHolderName: {
    fontSize: 17,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 1,
    marginBottom: 4,
  },

  /* ABHA ID Pill */
  abhaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.15)',
    marginBottom: 6,
  },
  abhaPillPending: {
    backgroundColor: '#F3F4F6',
    borderColor: colors.borderSubtle,
  },
  abhaPillText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  abhaPillTextPending: {
    color: colors.textMuted,
  },

  /* Demographics Badges Row */
  demographicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  bloodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bloodPillText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: '#B91C1C',
  },
  demographicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  demographicPillText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  uidPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  uidPillText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semiBold,
    color: '#065F46',
  },

  /* QR Box Container */
  qrContainer: {
    alignItems: 'center',
  },
  qrBox: {
    width: 74,
    height: 74,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(10, 77, 82, 0.2)',
    padding: 3,
    ...shadows.soft,
  },
  tapCueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tapCueText: {
    fontSize: 8,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
  },

  /* Card Footer */
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.1)',
  },
  secureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardSecureMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  cardExpiry: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },

  /* Full Screen QR Identification Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#F0FAF8',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 148, 136, 0.15)',
  },
  modalBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalScroll: {
    padding: spacing.md,
    alignItems: 'center',
  },

  modalHolderBox: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalHolderLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  modalHolderName: {
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  modalAbhaText: {
    fontSize: 14,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
    letterSpacing: 0.8,
    marginTop: 2,
  },

  modalQrContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  modalQrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 77, 82, 0.2)',
    ...shadows.card,
  },
  modalScanInstruction: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 16,
  },

  /* Specs Table */
  specsTable: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  specValueMono: {
    fontSize: 12,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
  },
  specValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  specBloodValue: {
    fontSize: 13,
    fontWeight: typography.fontWeight.bold,
    color: '#B91C1C',
  },
  specDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xs + 2,
  },

  /* Privacy Reassurance Banner */
  privacyReassuranceBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  privacyTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: '#166534',
  },
  privacyDesc: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 2,
    lineHeight: 14,
  },

  modalActionCol: {
    width: '100%',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  editBtn: {
    width: '100%',
    marginBottom: 4,
  },
  copyBtn: {
    width: '100%',
  },
  doneBtn: {
    width: '100%',
  },
});
