import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { ScreenContainer, Header, Input, Button, SelectableCard } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { profileService, OnboardingData } from '../../services/profile';

const TOTAL_STEPS = 7;

export const OnboardingScreen: React.FC = () => {
  const { user, completeOnboarding } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [data, setData] = useState<Partial<OnboardingData>>({
    basicIdentity: { preferredName: user?.name, gender: '' },
    communication: { interactionPreference: '', accessibility: [] },
    healthSnapshot: { generalStatus: '', broadConditions: [] },
    medicinesAllergies: { usesRegularMedicines: false, medicines: [], allergies: [] },
    lifestyle: { activityLevel: '', dietPreference: '', tobaccoUse: '', alcoholUse: '' },
    healthcarePreferences: { system: '' },
    healthGoals: [],
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const updateData = (key: keyof OnboardingData, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      animateTransition(() => setStep(step + 1));
    } else {
      await handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateTransition(() => setStep(step - 1));
    }
  };

  const handleSkip = async () => {
    await handleFinish();
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await profileService.updateProfile(user.id, data);
      completeOnboarding();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  };

  const renderStepIndicator = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
        <View key={idx} style={[styles.progressDot, idx + 1 <= step && styles.progressDotActive]} />
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text style={styles.stepTitle}>Basic Identity</Text>
            <Text style={styles.stepSubtitle}>How would you like us to address you?</Text>
            <Input
              label="Preferred Name"
              value={data.basicIdentity?.preferredName}
              onChangeText={(t) => updateData('basicIdentity', { ...data.basicIdentity, preferredName: t })}
              placeholder="e.g. Aarav"
            />
            <Text style={styles.label}>Gender</Text>
            {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => (
              <SelectableCard
                key={g}
                title={g}
                selected={data.basicIdentity?.gender === g}
                onSelect={() => updateData('basicIdentity', { ...data.basicIdentity, gender: g })}
              />
            ))}
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Communication</Text>
            <Text style={styles.stepSubtitle}>How do you prefer to interact?</Text>
            {['Voice', 'Text', 'Touch', 'Voice + Touch'].map((p) => (
              <SelectableCard
                key={p}
                title={p}
                selected={data.communication?.interactionPreference === p}
                onSelect={() => updateData('communication', { ...data.communication, interactionPreference: p })}
              />
            ))}
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>Health Snapshot</Text>
            <Text style={styles.stepSubtitle}>How would you describe your general health?</Text>
            {['Excellent', 'Good', 'Fair', 'Poor'].map((s) => (
              <SelectableCard
                key={s}
                title={s}
                selected={data.healthSnapshot?.generalStatus === s}
                onSelect={() => updateData('healthSnapshot', { ...data.healthSnapshot, generalStatus: s })}
              />
            ))}
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Medicines & Allergies</Text>
            <Text style={styles.stepSubtitle}>Do you use any regular medicines?</Text>
            <SelectableCard
              title="Yes"
              selected={data.medicinesAllergies?.usesRegularMedicines === true}
              onSelect={() => updateData('medicinesAllergies', { ...data.medicinesAllergies, usesRegularMedicines: true })}
            />
            <SelectableCard
              title="No"
              selected={data.medicinesAllergies?.usesRegularMedicines === false}
              onSelect={() => updateData('medicinesAllergies', { ...data.medicinesAllergies, usesRegularMedicines: false })}
            />
          </View>
        );
      case 5:
        return (
          <View>
            <Text style={styles.stepTitle}>Lifestyle</Text>
            <Text style={styles.stepSubtitle}>What is your daily activity level?</Text>
            {['Sedentary', 'Light', 'Moderate', 'Active'].map((a) => (
              <SelectableCard
                key={a}
                title={a}
                selected={data.lifestyle?.activityLevel === a}
                onSelect={() => updateData('lifestyle', { ...data.lifestyle, activityLevel: a })}
              />
            ))}
          </View>
        );
      case 6:
        return (
          <View>
            <Text style={styles.stepTitle}>Healthcare Preferences</Text>
            <Text style={styles.stepSubtitle}>What type of care do you prefer?</Text>
            {['Modern', 'AYUSH', 'Both', 'No preference'].map((s) => (
              <SelectableCard
                key={s}
                title={s}
                selected={data.healthcarePreferences?.system === s}
                onSelect={() => updateData('healthcarePreferences', { ...data.healthcarePreferences, system: s })}
              />
            ))}
          </View>
        );
      case 7:
        const goals = ['Manage health', 'Organize records', 'Wellness', 'Doctor preparation'];
        const selectedGoals = data.healthGoals || [];
        return (
          <View>
            <Text style={styles.stepTitle}>Health Goals</Text>
            <Text style={styles.stepSubtitle}>What do you want to achieve? (Select multiple)</Text>
            {goals.map((g) => (
              <SelectableCard
                key={g}
                title={g}
                multiSelect
                selected={selectedGoals.includes(g)}
                onSelect={() => {
                  const newGoals = selectedGoals.includes(g)
                    ? selectedGoals.filter((x) => x !== g)
                    : [...selectedGoals, g];
                  updateData('healthGoals', newGoals);
                }}
              />
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <Header title="Profile Setup" subtitle="Personalize your Vaidyaarc experience" />
      {renderStepIndicator()}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <View style={styles.navRow}>
          {step > 1 ? (
            <Button title="Back" variant="secondary" onPress={handleBack} style={styles.navBtn} />
          ) : <View style={styles.navBtn} />}
          <Button
            title={step === TOTAL_STEPS ? 'Finish' : 'Continue'}
            onPress={handleNext}
            loading={loading}
            style={styles.navBtn}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  skipBtn: {
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navBtn: {
    flex: 1,
  },
});
