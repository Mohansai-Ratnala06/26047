import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Input, Button, SelectableCard, Badge } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { profileService, OnboardingData } from '../../services/profile';
import { useTranslation } from '../../i18n';

const TOTAL_STEPS = 5;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const OnboardingScreen: React.FC = () => {
  const { user, completeOnboarding } = useAuthStore();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [data, setData] = useState<Partial<OnboardingData>>({
    basicIdentity: {
      preferredName: user?.name || '',
      gender: '',
      dateOfBirth: '',
      age: undefined,
      bloodGroup: '',
    },
    medicinesAllergies: {
      usesRegularMedicines: false,
      chronicConditions: [],
      allergies: [],
      medicines: [],
    },
    communication: {
      preferredLanguage: 'English',
      interactionPreference: 'Voice + Touch',
      accessibility: [],
    },
    lifestyle: {
      activityLevel: 'Moderate',
      dietPreference: 'Vegetarian',
      tobaccoUse: 'No',
      alcoholUse: 'No',
    },
    healthcarePreferences: {
      system: 'Integrative',
    },
  });

  // Interactive Date Picker Modal State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSelectingYear, setIsSelectingYear] = useState(false);
  const [pickerYear, setPickerYear] = useState(2000);
  const [pickerMonth, setPickerMonth] = useState(0); // 0-indexed (Jan = 0)
  const [pickerDay, setPickerDay] = useState(15);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const updateData = (key: keyof OnboardingData, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // Real-time Age Calculation from Year, Month, Day
  const calculateAge = (year: number, month: number, day: number) => {
    const today = new Date();
    let age = today.getFullYear() - year;
    const m = today.getMonth() - month;
    if (m < 0 || (m === 0 && today.getDate() < day)) {
      age--;
    }
    return Math.max(0, age);
  };

  const handleOpenDatePicker = () => {
    if (data.basicIdentity?.dateOfBirth) {
      const parts = data.basicIdentity.dateOfBirth.split('-');
      if (parts.length === 3) {
        setPickerYear(parseInt(parts[0], 10) || 2000);
        setPickerMonth((parseInt(parts[1], 10) - 1) || 0);
        setPickerDay(parseInt(parts[2], 10) || 15);
      }
    }
    setIsSelectingYear(false);
    setShowDatePicker(true);
  };

  const handleConfirmDate = () => {
    const monthStr = String(pickerMonth + 1).padStart(2, '0');
    const dayStr = String(pickerDay).padStart(2, '0');
    const dobString = `${pickerYear}-${monthStr}-${dayStr}`;
    const computedAge = calculateAge(pickerYear, pickerMonth, pickerDay);

    updateData('basicIdentity', {
      ...data.basicIdentity,
      dateOfBirth: dobString,
      age: computedAge,
    });
    setShowDatePicker(false);
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
      completeOnboarding(data.basicIdentity?.preferredName);
    } catch (e) {
      console.error('Failed to complete onboarding:', e);
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

  // Chronic Conditions Multi-Select Handler (Mutual exclusivity for "None")
  const handleConditionToggle = (condition: string) => {
    const current = data.medicinesAllergies?.chronicConditions || [];
    if (condition === 'None / No Chronic Conditions') {
      updateData('medicinesAllergies', {
        ...data.medicinesAllergies,
        chronicConditions: current.includes(condition) ? [] : ['None / No Chronic Conditions'],
      });
    } else {
      const filtered = current.filter((c) => c !== 'None / No Chronic Conditions');
      const next = filtered.includes(condition)
        ? filtered.filter((c) => c !== condition)
        : [...filtered, condition];
      updateData('medicinesAllergies', {
        ...data.medicinesAllergies,
        chronicConditions: next,
      });
    }
  };

  // Allergies Category Multi-Select Handler (Mutual exclusivity for "No Known Allergies")
  const handleAllergyToggle = (allergy: string) => {
    const current = data.medicinesAllergies?.allergies || [];
    if (allergy === 'No Known Allergies') {
      updateData('medicinesAllergies', {
        ...data.medicinesAllergies,
        allergies: current.includes(allergy) ? [] : ['No Known Allergies'],
      });
    } else {
      const filtered = current.filter((a) => a !== 'No Known Allergies');
      const next = filtered.includes(allergy)
        ? filtered.filter((a) => a !== allergy)
        : [...filtered, allergy];
      updateData('medicinesAllergies', {
        ...data.medicinesAllergies,
        allergies: next,
      });
    }
  };

  const getStepHeader = () => {
    switch (step) {
      case 1:
        return { title: 'Basic Identity & Demographics', subtitle: 'How would you like doctors and care teams to address you?' };
      case 2:
        return { title: 'Clinical Background', subtitle: 'Basic chronic conditions, allergies, and daily medicines' };
      case 3:
        return { title: 'Communication & Language', subtitle: 'Preferred consultation channels and language' };
      case 4:
        return { title: 'Lifestyle & Habits', subtitle: 'Helps personalize wellness and preventive insights' };
      case 5:
        return { title: 'Healthcare Preferences', subtitle: 'Which systems of medical practice do you prefer?' };
      default:
        return { title: 'Patient Profile', subtitle: '' };
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.progressSection}>
      <View style={styles.progressContainer}>
        {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressDot,
              idx + 1 === step && styles.progressDotCurrent,
              idx + 1 < step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>
      <View style={styles.stepCounterRow}>
        <Text style={styles.stepCounterText}>Step {step} of {TOTAL_STEPS}</Text>
        <Text style={styles.stepCategoryBadge}>{getStepHeader().title}</Text>
      </View>
    </View>
  );

  // Render Days Grid for Calendar Modal
  const renderCalendarDays = () => {
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const firstDayIndex = new Date(pickerYear, pickerMonth, 1).getDay();

    const emptySlots = Array.from({ length: firstDayIndex });
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <View style={styles.daysGrid}>
        {emptySlots.map((_, idx) => (
          <View key={`empty-${idx}`} style={styles.dayCell} />
        ))}
        {dayNumbers.map((d) => {
          const isSelected = pickerDay === d;
          return (
            <TouchableOpacity
              key={`day-${d}`}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => setPickerDay(d)}
            >
              <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render Year Picker Grid for fast Year Jumping
  const renderYearPicker = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

    return (
      <View style={styles.yearPickerContainer}>
        <Text style={styles.yearPickerGuide}>Tap a year to jump directly:</Text>
        <FlatList
          data={years}
          keyExtractor={(item) => String(item)}
          numColumns={4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.yearGridContent}
          renderItem={({ item }) => {
            const isSelected = pickerYear === item;
            return (
              <TouchableOpacity
                style={[styles.yearCell, isSelected && styles.yearCellSelected]}
                onPress={() => {
                  setPickerYear(item);
                  setIsSelectingYear(false);
                }}
              >
                <Text style={[styles.yearCellText, isSelected && styles.yearCellTextSelected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      // STEP 1: Basic Identity & Demographics
      case 1:
        const dobFormatted = data.basicIdentity?.dateOfBirth
          ? `${new Date(data.basicIdentity.dateOfBirth).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })} (Age: ${data.basicIdentity.age ?? '--'} yrs)`
          : null;

        return (
          <View>
            <Text style={styles.stepTitle}>Basic Identity</Text>
            <Text style={styles.stepSubtitle}>Provide your basic demographics for official digital health records</Text>

            {/* Preferred Name */}
            <Input
              label="Full / Preferred Name"
              value={data.basicIdentity?.preferredName}
              onChangeText={(t) => updateData('basicIdentity', { ...data.basicIdentity, preferredName: t })}
              placeholder="e.g. Aarav Sharma"
              leadingIcon={<Ionicons name="person-outline" size={18} color={colors.textMuted} />}
            />

            {/* Gender Selection */}
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => (
                <SelectableCard
                  key={g}
                  title={g}
                  selected={data.basicIdentity?.gender?.toLowerCase() === g.toLowerCase()}
                  onSelect={() => updateData('basicIdentity', { ...data.basicIdentity, gender: g })}
                />
              ))}
            </View>

            {/* Date of Birth & Computed Age Selector */}
            <Text style={styles.label}>Date of Birth & Age</Text>
            <TouchableOpacity
              style={styles.dobCard}
              onPress={handleOpenDatePicker}
              activeOpacity={0.7}
              accessibilityLabel="Select Date of Birth"
            >
              <View style={styles.dobLeftCol}>
                <View style={styles.dobIconBox}>
                  <Ionicons name="calendar" size={22} color={colors.primary} />
                </View>
                <View style={styles.dobTextCol}>
                  <Text style={styles.dobLabel}>Date of Birth</Text>
                  <Text style={[styles.dobValue, !dobFormatted && styles.dobValuePlaceholder]}>
                    {dobFormatted || 'Tap to choose Date of Birth in calendar'}
                  </Text>
                </View>
              </View>

              {data.basicIdentity?.age !== undefined ? (
                <Badge label={`${data.basicIdentity.age} Yrs`} variant="mint" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* Blood Group Selector (4x2 Chip Grid) */}
            <Text style={styles.label}>Blood Group</Text>
            <Text style={styles.subLabel}>Essential for emergency cards and transfusion compatibility</Text>
            <View style={styles.bloodGroupGrid}>
              {BLOOD_GROUPS.map((bg) => {
                const isSelected = data.basicIdentity?.bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.bloodGroupChip, isSelected && styles.bloodGroupChipActive]}
                    onPress={() => updateData('basicIdentity', { ...data.basicIdentity, bloodGroup: bg })}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="water"
                      size={14}
                      color={isSelected ? '#FFFFFF' : colors.error}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.bloodGroupChipText, isSelected && styles.bloodGroupChipTextActive]}>
                      {bg}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // STEP 2: Clinical Background (Chronic Diseases, Allergies & Regular Meds)
      case 2:
        const chronicOptions = [
          'None / No Chronic Conditions',
          'Hypertension (High BP)',
          'Diabetes (Type 1 / Type 2)',
          'Thyroid Disorder',
          'Asthma / Respiratory Conditions',
        ];

        const allergyHeadings = [
          'No Known Allergies',
          'Medical / Drug related',
          'Food related',
          'Herbs / AYUSH related',
          'Skin / Contact related',
          'Respiratory related',
        ];

        const selectedConditions = data.medicinesAllergies?.chronicConditions || [];
        const selectedAllergies = data.medicinesAllergies?.allergies || [];

        return (
          <View>
            <Text style={styles.stepTitle}>Clinical Background</Text>
            <Text style={styles.stepSubtitle}>
              Essential medical context to ensure safe prescriptions and AI diagnostics
            </Text>

            {/* Section 1: Chronic Conditions */}
            <Text style={styles.sectionHeading}>Basic Chronic Conditions</Text>
            <Text style={styles.subLabel}>Do you have any existing chronic illnesses? (Select all that apply)</Text>
            {chronicOptions.map((c) => (
              <SelectableCard
                key={c}
                title={c}
                multiSelect
                icon={c.includes('None') ? 'shield-checkmark-outline' : 'pulse-outline'}
                selected={selectedConditions.includes(c)}
                onSelect={() => handleConditionToggle(c)}
              />
            ))}

            {/* Section 2: Known Allergies */}
            <Text style={[styles.sectionHeading, { marginTop: spacing.lg }]}>Known Allergies</Text>
            <Text style={styles.subLabel}>Select allergy categories you experience (or choose None):</Text>
            {allergyHeadings.map((a) => (
              <SelectableCard
                key={a}
                title={a}
                multiSelect
                icon={a.includes('No Known') ? 'checkmark-circle-outline' : 'warning-outline'}
                selected={selectedAllergies.includes(a)}
                onSelect={() => handleAllergyToggle(a)}
              />
            ))}

            {/* Section 3: Regular Medications */}
            <Text style={[styles.sectionHeading, { marginTop: spacing.lg }]}>Regular Medications</Text>
            <Text style={styles.subLabel}>Do you currently take any prescribed medicines on a daily basis?</Text>
            <SelectableCard
              title="Yes (Taking regular medicines)"
              icon="medkit-outline"
              selected={data.medicinesAllergies?.usesRegularMedicines === true}
              onSelect={() =>
                updateData('medicinesAllergies', {
                  ...data.medicinesAllergies,
                  usesRegularMedicines: true,
                })
              }
            />
            <SelectableCard
              title="No (Not taking regular medicines)"
              icon="close-circle-outline"
              selected={data.medicinesAllergies?.usesRegularMedicines === false}
              onSelect={() =>
                updateData('medicinesAllergies', {
                  ...data.medicinesAllergies,
                  usesRegularMedicines: false,
                })
              }
            />
          </View>
        );

      // STEP 3: Communication & Language
      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>Communication & Language</Text>
            <Text style={styles.stepSubtitle}>How do you prefer to interact and receive consultations?</Text>

            <Text style={styles.label}>Preferred Interaction Mode</Text>
            {['Voice (Spoken Telugu / Hindi / English)', 'Text (Chat & Messaging)', 'Touch (Buttons & Forms)', 'Voice + Touch (Multimodal)'].map((p) => (
              <SelectableCard
                key={p}
                title={p}
                icon="chatbubbles-outline"
                selected={data.communication?.interactionPreference === p}
                onSelect={() => updateData('communication', { ...data.communication, interactionPreference: p })}
              />
            ))}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Primary Language</Text>
            {[
              { code: 'English', label: 'English (Clinical Standard)' },
              { code: 'Telugu', label: 'తెలుగు (Telugu)' },
              { code: 'Hindi', label: 'हिन्दी (Hindi)' },
            ].map((lang) => (
              <SelectableCard
                key={lang.code}
                title={lang.label}
                icon="language-outline"
                selected={data.communication?.preferredLanguage === lang.code}
                onSelect={() => updateData('communication', { ...data.communication, preferredLanguage: lang.code })}
              />
            ))}
          </View>
        );

      // STEP 4: Lifestyle & Diet
      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Lifestyle & Daily Habits</Text>
            <Text style={styles.stepSubtitle}>Helps us tailor preventive wellness and metabolic insights</Text>

            <Text style={styles.label}>Daily Physical Activity</Text>
            {[
              { id: 'Sedentary', title: 'Sedentary (Little or no exercise)' },
              { id: 'Light', title: 'Light (Exercise 1-2 days/week)' },
              { id: 'Moderate', title: 'Moderate (Exercise 3-5 days/week)' },
              { id: 'Active', title: 'Active (Intense exercise 6-7 days/week)' },
            ].map((a) => (
              <SelectableCard
                key={a.id}
                title={a.title}
                icon="walk-outline"
                selected={data.lifestyle?.activityLevel === a.id}
                onSelect={() => updateData('lifestyle', { ...data.lifestyle, activityLevel: a.id })}
              />
            ))}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Dietary Preference</Text>
            {['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'].map((d) => (
              <SelectableCard
                key={d}
                title={d}
                icon="restaurant-outline"
                selected={data.lifestyle?.dietPreference === d}
                onSelect={() => updateData('lifestyle', { ...data.lifestyle, dietPreference: d })}
              />
            ))}
          </View>
        );

      // STEP 5: Healthcare System Preferences
      case 5:
        return (
          <View>
            <Text style={styles.stepTitle}>Healthcare System Preferences</Text>
            <Text style={styles.stepSubtitle}>Which systems of medical practice do you prefer for consultations?</Text>

            {[
              { id: 'Modern', title: 'Modern (Allopathy)', subtitle: 'Evidence-based biomedical diagnostics and pharmacology' },
              { id: 'AYUSH', title: 'AYUSH (Ayurveda, Yoga, Unani, Siddha, Homeopathy)', subtitle: 'Traditional Indian medicine and holistic wellness' },
              { id: 'Integrative', title: 'Integrative (Both Modern & AYUSH)', subtitle: 'Synergistic combination of allopathy with AYUSH modalities' },
              { id: 'No preference', title: 'No preference / Need-based', subtitle: 'Recommend the best suited approach for each condition' },
            ].map((s) => (
              <SelectableCard
                key={s.id}
                title={s.title}
                subtitle={s.subtitle}
                icon="fitness-outline"
                selected={data.healthcarePreferences?.system === s.id}
                onSelect={() => updateData('healthcarePreferences', { ...data.healthcarePreferences, system: s.id })}
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
      <Header
        title="Complete Health Setup"
        subtitle="Set up your verified digital health account"
      />

      {renderStepIndicator()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      {/* Footer Navigation Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <View style={styles.navRow}>
          {step > 1 ? (
            <Button
              title={t('common.back')}
              variant="secondary"
              onPress={handleBack}
              style={styles.navBtn}
            />
          ) : (
            <View style={styles.navBtn} />
          )}
          <Button
            title={step === TOTAL_STEPS ? 'Complete Setup' : `Next (Step ${step + 1})`}
            onPress={handleNext}
            loading={loading}
            style={styles.navBtn}
          />
        </View>
      </View>

      {/* ========================================================== */}
      {/* INTERACTIVE CALENDAR & DATE PICKER MODAL */}
      {/* ========================================================== */}
      <Modal
        visible={showDatePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerCard}>
            {/* Modal Header */}
            <View style={styles.datePickerHeader}>
              <View>
                <Text style={styles.datePickerTitle}>Choose Date of Birth</Text>
                <Text style={styles.datePickerSubtitle}>Calculates exact age automatically</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Toolbar */}
            <View style={styles.calendarToolbar}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear((y) => y - 1);
                  } else {
                    setPickerMonth((m) => m - 1);
                  }
                }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.toolbarCenter}>
                <Text style={styles.toolbarMonthText}>{MONTH_NAMES[pickerMonth]}</Text>
                <TouchableOpacity
                  style={styles.yearBadgeBtn}
                  onPress={() => setIsSelectingYear(!isSelectingYear)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.yearBadgeText}>{pickerYear}</Text>
                  <Ionicons
                    name={isSelectingYear ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear((y) => y + 1);
                  } else {
                    setPickerMonth((m) => m + 1);
                  }
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Quick Month Selector Chips */}
            {!isSelectingYear && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthChipsRow}
              >
                {SHORT_MONTH_NAMES.map((mName, idx) => {
                  const isCurMonth = pickerMonth === idx;
                  return (
                    <TouchableOpacity
                      key={mName}
                      style={[styles.monthChip, isCurMonth && styles.monthChipActive]}
                      onPress={() => setPickerMonth(idx)}
                    >
                      <Text style={[styles.monthChipText, isCurMonth && styles.monthChipTextActive]}>
                        {mName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Body: Year Selection Grid OR Calendar Days Grid */}
            {isSelectingYear ? (
              renderYearPicker()
            ) : (
              <View style={styles.calendarBody}>
                {/* Weekday Row */}
                <View style={styles.weekdaysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Text key={day} style={styles.weekdayText}>
                      {day}
                    </Text>
                  ))}
                </View>
                {/* Days Grid */}
                {renderCalendarDays()}
              </View>
            )}

            {/* Real-time Calculated Age Callout */}
            <View style={styles.calculatedAgeRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.calculatedAgeText}>
                Selected: {pickerDay} {SHORT_MONTH_NAMES[pickerMonth]} {pickerYear} •{' '}
                <Text style={styles.calculatedAgeHighlight}>
                  {calculateAge(pickerYear, pickerMonth, pickerDay)} Years Old
                </Text>
              </Text>
            </View>

            {/* Confirmation Actions */}
            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowDatePicker(false)}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title="Set Date of Birth"
                variant="primary"
                onPress={handleConfirmDate}
                style={{ flex: 1.5, marginLeft: spacing.xs }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
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
  progressDotCurrent: {
    backgroundColor: colors.primaryDark,
    height: 5,
  },
  stepCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCounterText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semiBold,
  },
  stepCategoryBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
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
    lineHeight: 20,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  subLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  genderRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  dobLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dobIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.mintWash,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  dobTextCol: {
    flex: 1,
  },
  dobLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  dobValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2,
  },
  dobValuePlaceholder: {
    color: colors.textMuted,
    fontWeight: typography.fontWeight.regular,
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  bloodGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22%',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  bloodGroupChipActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  bloodGroupChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  bloodGroupChipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  skipBtn: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  skipText: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navBtn: {
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  datePickerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 380,
    padding: spacing.md,
    maxHeight: '92%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.sm,
  },
  datePickerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  datePickerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  calendarToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  navArrowBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle || '#F1F5F9',
  },
  toolbarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolbarMonthText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  yearBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintWash,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full || 999,
  },
  yearBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  monthChipsRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  monthChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle || '#F1F5F9',
  },
  monthChipActive: {
    backgroundColor: colors.primary,
  },
  monthChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  calendarBody: {
    marginVertical: spacing.xs,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 20,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  yearPickerContainer: {
    height: 240,
    paddingVertical: spacing.xs,
  },
  yearPickerGuide: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  yearGridContent: {
    gap: spacing.xs,
  },
  yearCell: {
    flex: 1,
    margin: 4,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle || '#F1F5F9',
    borderRadius: borderRadius.md,
  },
  yearCellSelected: {
    backgroundColor: colors.primary,
  },
  yearCellText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semiBold,
  },
  yearCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  calculatedAgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle || '#F1F5F9',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  calculatedAgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  calculatedAgeHighlight: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.bold,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
