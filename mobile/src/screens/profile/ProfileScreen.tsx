import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, ProfileCard, Card, Button, SectionHeader } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
    }
  }, [user?.id]);

  return (
    <ScreenContainer scrollable hasBottomTabs>
      <Header title="My Profile" subtitle="Identity, health card & settings" />

      {/* Modular Profile Card */}
      <ProfileCard
        name={user?.name || ''}
        email={user?.email || 'No email provided'}
        phone={user?.phone || ''}
        abhaId={user?.abhaId || 'Pending'}
      />

      {/* Modular Extension Modules */}
      <SectionHeader title="Health & Preferences" />

      <Card variant="outlined" style={styles.modularSectionCard}>
        {/* 1. Health Profile Slot */}
        <TouchableOpacity style={styles.moduleRow} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="fitness-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Health Profile</Text>
            <Text style={styles.moduleDesc}>
              {profile?.healthSnapshot?.generalStatus 
                ? `General Status: ${profile.healthSnapshot.generalStatus}` 
                : 'Vitals, allergies, chronic conditions'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 2. Consent Management Slot */}
        <TouchableOpacity style={styles.moduleRow} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Consent & Data Sharing</Text>
            <Text style={styles.moduleDesc}>
              {profile?.healthcarePreferences?.system
                ? `Preference: ${profile.healthcarePreferences.system}`
                : 'ABDM electronic consent manager'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 3. Identifiers Slot */}
        <TouchableOpacity style={styles.moduleRow} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Digital Identifiers</Text>
            <Text style={styles.moduleDesc}>ABHA ID, Aadhaar / Mobile linking</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 4. Language & Localization Slot */}
        <TouchableOpacity style={styles.moduleRow} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="language-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Language & Voice</Text>
            <Text style={styles.moduleDesc}>
              {profile?.communication?.interactionPreference 
                ? `Interaction: ${profile.communication.interactionPreference}` 
                : 'English (Indic voice engine ready)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 5. Privacy & Security Slot */}
        <TouchableOpacity style={styles.moduleRow} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Privacy & Security</Text>
            <Text style={styles.moduleDesc}>Biometric authentication, audit logs</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 6. Accessibility Slot */}
        <TouchableOpacity style={[styles.moduleRow, styles.lastRow]} activeOpacity={0.7}>
          <View style={styles.moduleIconCircle}>
            <Ionicons name="accessibility-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.moduleTextCol}>
            <Text style={styles.moduleTitle}>Accessibility</Text>
            <Text style={styles.moduleDesc}>High contrast, screen reader optimization</Text>
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
});
