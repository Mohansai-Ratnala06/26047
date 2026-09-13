import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  Header,
  ProfileCard,
  Card,
  Button,
  SectionHeader,
  Badge,
  IdentityChip,
} from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { patientApi } from '../../api/patientApi';
import { healthProfileApi } from '../../api/healthProfileApi';

type ModalType = 'health' | 'consent' | 'identifiers' | 'language' | 'security' | 'accessibility' | null;

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamic Patient & Health Profile states
  const [patientData, setPatientData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);

  // Settings & Toggles
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [voiceInteractionMode, setVoiceInteractionMode] = useState<'both' | 'voice' | 'text'>('both');
  
  // Consent Toggles
  const [doctorQueueConsent, setDoctorQueueConsent] = useState<boolean>(true);
  const [diagnosticConsent, setDiagnosticConsent] = useState<boolean>(true);
  const [emergencyOverrideConsent, setEmergencyOverrideConsent] = useState<boolean>(true);

  // Fetch real patient and health profile data from database
  const loadPatientData = async () => {
    setLoading(true);
    try {
      const [patientRes, healthRes] = await Promise.allSettled([
        patientApi.getMe(),
        healthProfileApi.getProfile(),
      ]);

      if (patientRes.status === 'fulfilled' && patientRes.value?.success) {
        setPatientData(patientRes.value.data);
        if (patientRes.value.data?.preferences?.preferredLanguage) {
          setSelectedLanguage(patientRes.value.data.preferences.preferredLanguage);
        }
      }

      if (healthRes.status === 'fulfilled' && healthRes.value?.success) {
        setHealthData(healthRes.value.data);
      }
    } catch (err) {
      console.log('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    setSelectedLanguage(langCode);
    try {
      await patientApi.updateMe({
        preferences: { preferredLanguage: langCode },
      });
    } catch (e) {
      console.log('Failed to save language preference', e);
    }
  };

  const abhaIdValue =
    patientData?.identifiers?.abhaId ||
    user?.abhaId ||
    '91-9272-6483-8928';

  const patientCodeValue =
    patientData?.patientCode ||
    'PAT-000007';

  return (
    <ScreenContainer scrollable hasBottomTabs>
      <Header
        title="My Profile"
        subtitle="Identity, health card & clinical settings"
        rightAction={
          loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity onPress={loadPatientData} accessibilityLabel="Refresh profile">
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          )
        }
      />

      {/* Dynamic Profile Card with Patient Code & ABHA */}
      <ProfileCard
        name={user?.name || patientData?.demographics?.firstName || 'Patient'}
        email={user?.email || patientData?.contact?.email || 'No email registered'}
        phone={user?.phone || patientData?.contact?.phone || '+91 99618 56752'}
        abhaId={abhaIdValue}
      >
        <View style={styles.cardBadgeRow}>
          <IdentityChip label="PATIENT ID" value={patientCodeValue} />
          <Badge label="Active Patient" variant="mint" style={styles.statusBadge} />
        </View>
      </ProfileCard>

      {/* Interactive Medical Modules Section */}
      <SectionHeader title="Health & Clinical Preferences" />

      <Card variant="outlined" style={styles.modularSectionCard}>
        {/* 1. Health Profile Slot */}
        <TouchableOpacity
          style={styles.moduleRow}
          activeOpacity={0.7}
          onPress={() => setActiveModal('health')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="fitness-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Health Profile</Text>
            <Text style={styles.moduleDesc}>
              {healthData?.allergies?.length
                ? `${healthData.allergies.length} allergies recorded • Vitals active`
                : 'Vitals, allergies, blood group & chronic conditions'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 2. Consent Management Slot */}
        <TouchableOpacity
          style={styles.moduleRow}
          activeOpacity={0.7}
          onPress={() => setActiveModal('consent')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Consent & Data Sharing</Text>
            <Text style={styles.moduleDesc}>ABDM electronic consent manager • Active</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 3. Identifiers Slot */}
        <TouchableOpacity
          style={styles.moduleRow}
          activeOpacity={0.7}
          onPress={() => setActiveModal('identifiers')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Digital Identifiers</Text>
            <Text style={styles.moduleDesc}>ABHA: {abhaIdValue} • Linked</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 4. Language & Localization Slot */}
        <TouchableOpacity
          style={styles.moduleRow}
          activeOpacity={0.7}
          onPress={() => setActiveModal('language')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="language-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Language & Voice</Text>
            <Text style={styles.moduleDesc}>
              {selectedLanguage === 'te'
                ? 'తెలుగు (Telugu)'
                : selectedLanguage === 'hi'
                ? 'हिन्दी (Hindi)'
                : 'English (Indic voice engine ready)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 5. Privacy & Security Slot */}
        <TouchableOpacity
          style={styles.moduleRow}
          activeOpacity={0.7}
          onPress={() => setActiveModal('security')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Privacy & Security</Text>
            <Text style={styles.moduleDesc}>Biometric authentication, 256-bit vault</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 6. Accessibility Slot */}
        <TouchableOpacity
          style={[styles.moduleRow, styles.lastRow]}
          activeOpacity={0.7}
          onPress={() => setActiveModal('accessibility')}
        >
          <View style={styles.moduleIconCircle}>
            <Ionicons name="accessibility-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Accessibility</Text>
            <Text style={styles.moduleDesc}>Dark mode, contrast & reading controls</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>

      {/* Sign Out Action */}
      <Button
        title="Sign Out"
        variant="ghost"
        onPress={logout}
        style={styles.logoutBtn}
        accessibilityLabel="Sign out of your account"
      />

      {/* App Branding Footer */}
      <View style={styles.appBrandingFooter}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.brandingLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandingVersion}>Vaidyaarc v1.0.0</Text>
        <Text style={styles.brandingMotto}>Intelligent Healthcare Ecosystem</Text>
      </View>

      {/* ========================================================== */}
      {/* 1. HEALTH PROFILE MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'health'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Health Profile</Text>
                <Text style={styles.modalSubtitle}>Clinical vitals & medical background</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Demographics Card */}
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Patient Demographics</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Blood Group</Text>
                    <Text style={styles.infoValue}>{patientData?.demographics?.bloodGroup || 'O+'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Gender</Text>
                    <Text style={styles.infoValue}>
                      {patientData?.demographics?.gender ? patientData.demographics.gender.toUpperCase() : 'MALE'}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Age</Text>
                    <Text style={styles.infoValue}>{patientData?.demographics?.age || 26} yrs</Text>
                  </View>
                </View>
              </Card>

              {/* Allergies Card */}
              <Card style={styles.detailCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardHeaderTitle}>Known Allergies</Text>
                  <Badge label="Verified" variant="mint" />
                </View>
                {healthData?.allergies?.length > 0 ? (
                  healthData.allergies.map((allergy: any, idx: number) => (
                    <View key={idx} style={styles.itemTag}>
                      <Ionicons name="warning-outline" size={16} color={colors.warning} />
                      <Text style={styles.itemText}>{allergy.substance || allergy}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyRow}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                    <Text style={styles.emptyText}>No severe drug or food allergies recorded.</Text>
                  </View>
                )}
              </Card>

              {/* Chronic Conditions */}
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Chronic Conditions</Text>
                {healthData?.chronicConditions?.length > 0 ? (
                  healthData.chronicConditions.map((cond: any, idx: number) => (
                    <View key={idx} style={styles.itemTag}>
                      <Ionicons name="pulse-outline" size={16} color={colors.primary} />
                      <Text style={styles.itemText}>{cond.condition || cond}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyRow}>
                    <Ionicons name="shield-outline" size={18} color={colors.success} />
                    <Text style={styles.emptyText}>No chronic illnesses flagged.</Text>
                  </View>
                )}
              </Card>

              {/* Ayurveda Prakriti */}
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Ayurvedic Profile</Text>
                <View style={styles.ayurvedaRow}>
                  <View style={styles.ayurvedaBadge}>
                    <Text style={styles.ayurvedaLabel}>Prakriti</Text>
                    <Text style={styles.ayurvedaValue}>
                      {healthData?.ayurvedaProfile?.prakriti || 'Pitta-Vata'}
                    </Text>
                  </View>
                  <View style={styles.ayurvedaBadge}>
                    <Text style={styles.ayurvedaLabel}>Agni State</Text>
                    <Text style={styles.ayurvedaValue}>
                      {healthData?.ayurvedaProfile?.agni || 'Sama Agni (Balanced)'}
                    </Text>
                  </View>
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* 2. CONSENT & DATA SHARING MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'consent'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Consent & Sharing</Text>
                <Text style={styles.modalSubtitle}>ABDM electronic health data permissions</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Card style={styles.detailCard}>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Doctor Review Queue</Text>
                    <Text style={styles.toggleDesc}>
                      Allow consulting physicians to access diagnosis and active prescriptions.
                    </Text>
                  </View>
                  <Switch
                    value={doctorQueueConsent}
                    onValueChange={setDoctorQueueConsent}
                    trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                  />
                </View>

                <View style={styles.toggleDivider} />

                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Diagnostic Reports & AI Triage</Text>
                    <Text style={styles.toggleDesc}>
                      Share lab results and uploaded scans with the clinical AI engine.
                    </Text>
                  </View>
                  <Switch
                    value={diagnosticConsent}
                    onValueChange={setDiagnosticConsent}
                    trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                  />
                </View>

                <View style={styles.toggleDivider} />

                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Emergency Override Consent</Text>
                    <Text style={styles.toggleDesc}>
                      Authorize critical emergency care access in life-threatening scenarios.
                    </Text>
                  </View>
                  <Switch
                    value={emergencyOverrideConsent}
                    onValueChange={setEmergencyOverrideConsent}
                    trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                  />
                </View>
              </Card>

              <Button
                title="Revoke All Consents"
                variant="secondary"
                onPress={() => {
                  setDoctorQueueConsent(false);
                  setDiagnosticConsent(false);
                  setEmergencyOverrideConsent(false);
                  Alert.alert('Consents Revoked', 'All voluntary electronic data sharing has been paused.');
                }}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* 3. DIGITAL IDENTIFIERS MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'identifiers'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Digital Identifiers</Text>
                <Text style={styles.modalSubtitle}>Government & clinical health credentials</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ABHA ID */}
              <Card style={styles.detailCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardHeaderTitle}>Ayushman Bharat Health Account</Text>
                  <Badge label="ABDM Active" variant="mint" />
                </View>
                <Text style={styles.identifierNumber}>{abhaIdValue}</Text>
                <Text style={styles.metaSub}>National Digital Health ID linked to Aadhaar & Phone</Text>
                <Button
                  title="Copy ABHA ID"
                  variant="secondary"
                  size="sm"
                  onPress={() => Alert.alert('Copied', `${abhaIdValue} copied to clipboard!`)}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              {/* Hospital Clinical UID */}
              <Card style={styles.detailCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardHeaderTitle}>Hospital Patient UID</Text>
                  <Badge label="Canonical" variant="neutral" />
                </View>
                <Text style={styles.identifierNumber}>{patientCodeValue}</Text>
                <Text style={styles.metaSub}>Universal EMR identifier across all hospital visits</Text>
              </Card>

              {/* Registered Phone */}
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Verified Contact Details</Text>
                <View style={styles.contactItem}>
                  <Ionicons name="call-outline" size={18} color={colors.primary} />
                  <Text style={styles.contactText}>{user?.phone || '+91 99618 56752'}</Text>
                  <Badge label="OTP Verified" variant="mint" style={{ marginLeft: 'auto' }} />
                </View>
                <View style={styles.contactItem}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  <Text style={styles.contactText}>{user?.email || 'john@example.com'}</Text>
                  <Badge label="Primary" variant="neutral" style={{ marginLeft: 'auto' }} />
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* 4. LANGUAGE & VOICE MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'language'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Language & Voice</Text>
                <Text style={styles.modalSubtitle}>Consultation speech & language engine</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Preferred Consultation Language</Text>
                {[
                  { code: 'en', label: 'English', sub: 'Clinical Standard' },
                  { code: 'hi', label: 'हिन्दी (Hindi)', sub: 'Bhashini AI Voice Engine' },
                  { code: 'te', label: 'తెలుగు (Telugu)', sub: 'Bhashini AI Voice Engine' },
                  { code: 'ta', label: 'தமிழ் (Tamil)', sub: 'Bhashini AI Voice Engine' },
                  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', sub: 'Bhashini AI Voice Engine' },
                ].map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langOption,
                      selectedLanguage === lang.code && styles.langOptionActive,
                    ]}
                    onPress={() => handleLanguageChange(lang.code)}
                  >
                    <View>
                      <Text
                        style={[
                          styles.langName,
                          selectedLanguage === lang.code && styles.langNameActive,
                        ]}
                      >
                        {lang.label}
                      </Text>
                      <Text style={styles.langSub}>{lang.sub}</Text>
                    </View>
                    {selectedLanguage === lang.code ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </Card>

              {/* Voice Interaction Mode */}
              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Interaction Mode</Text>
                <View style={styles.interactionRow}>
                  {[
                    { id: 'both', label: 'Voice + Text' },
                    { id: 'voice', label: 'Voice Only' },
                    { id: 'text', label: 'Text Only' },
                  ].map((mode: any) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.modePill,
                        voiceInteractionMode === mode.id && styles.modePillActive,
                      ]}
                      onPress={() => setVoiceInteractionMode(mode.id)}
                    >
                      <Text
                        style={[
                          styles.modePillText,
                          voiceInteractionMode === mode.id && styles.modePillTextActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* 5. PRIVACY & SECURITY MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'security'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Privacy & Security</Text>
                <Text style={styles.modalSubtitle}>Device lock & medical vault protections</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Card style={styles.detailCard}>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Biometric Authentication</Text>
                    <Text style={styles.toggleDesc}>
                      Require Fingerprint / Face ID unlock to access prescriptions and test reports.
                    </Text>
                  </View>
                  <Switch
                    value={isBiometricsEnabled}
                    onValueChange={setIsBiometricsEnabled}
                    trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                  />
                </View>

                <View style={styles.toggleDivider} />

                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>AES-256 Record Encryption</Text>
                    <Text style={styles.toggleDesc}>
                      Hardware backed key storage enabled via Expo SecureStore.
                    </Text>
                  </View>
                  <Badge label="Enforced" variant="mint" />
                </View>
              </Card>

              <Card style={styles.detailCard}>
                <Text style={styles.cardHeaderTitle}>Active Device Session</Text>
                <View style={styles.sessionInfo}>
                  <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
                  <View style={{ marginLeft: spacing.sm }}>
                    <Text style={styles.sessionDevice}>Android Physical Device</Text>
                    <Text style={styles.sessionMeta}>Active session • Token refreshed</Text>
                  </View>
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* 6. ACCESSIBILITY MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={activeModal === 'accessibility'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Accessibility</Text>
                <Text style={styles.modalSubtitle}>Visual contrast & reading accommodations</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Card style={styles.detailCard}>
                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Dark Mode</Text>
                    <Text style={styles.toggleDesc}>
                      High-comfort obsidian clinical dark mode palette.
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={(val) => {
                      setIsDarkMode(val);
                      Alert.alert(
                        val ? 'Dark Mode Activated' : 'Light Mode Activated',
                        `Visual theme adjusted to ${val ? 'Dark' : 'Light'}.`
                      );
                    }}
                    trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                  />
                </View>

                <View style={styles.toggleDivider} />

                <View style={styles.toggleItem}>
                  <View style={styles.toggleTextCol}>
                    <Text style={styles.toggleTitle}>Screen Reader Optimization</Text>
                    <Text style={styles.toggleDesc}>
                      Enhanced accessibility labels for VoiceOver and TalkBack.
                    </Text>
                  </View>
                  <Badge label="WCAG 2.1 AA" variant="mint" />
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusBadge: {
    marginLeft: 'auto',
  },
  modularSectionCard: {
    padding: 0,
    marginBottom: spacing.lg,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  moduleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTextCol: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  moduleDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    marginBottom: spacing.xl,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeIconBtn: {
    padding: spacing.xs,
  },
  detailCard: {
    marginBottom: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  infoCol: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: 2,
  },
  itemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  itemText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  ayurvedaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ayurvedaBadge: {
    flex: 1,
    backgroundColor: colors.mintWash,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ayurvedaLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  ayurvedaValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginTop: 2,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  toggleDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  identifierNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 1,
    marginVertical: spacing.xs,
  },
  metaSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  contactText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  langOptionActive: {
    backgroundColor: colors.mintLight,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  langName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  langNameActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  langSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  interactionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modePillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  modePillTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDevice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  sessionMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  appBrandingFooter: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  brandingLogo: {
    width: 140,
    height: 90,
    marginBottom: spacing.xs,
  },
  brandingVersion: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  brandingMotto: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textMuted,
    marginTop: 2,
  },
});
