import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { IconChartBar } from '@tabler/icons-react-native';
import { colors, typography, spacing } from '../../theme';
import { SegmentedToggle, Chip, MetricCard } from './index';

const CARD_WIDTH = Dimensions.get('window').width - 32;

const riskTimeline = [
  { date: '2019', text: 'Type 2 diabetes diagnosed', severity: 'neutral' },
  { date: '2022', text: 'Hypertension diagnosed, started on Atenolol', severity: 'neutral' },
  { date: '12 Aug', text: 'Cholesterol flagged high, 265 mg/dL', severity: 'warning' },
  { date: 'Today', text: 'Chest pain with breathlessness', severity: 'danger' },
];

export const ProfileSlider: React.FC = () => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const goToTab = (index: 0 | 1) => {
    setActiveTab(index);
    Animated.timing(translateX, {
      toValue: index === 0 ? 0 : -CARD_WIDTH,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrapper}>
        <SegmentedToggle options={['Risk profile', 'Health profile']} activeIndex={activeTab} onChange={goToTab} />
      </View>

      <View style={styles.sliderWindow}>
        <Animated.View style={[styles.sliderTrack, { transform: [{ translateX }] }]}>
          {/* Panel 1 — Risk profile */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Risk profile</Text>
              <Chip label="High risk" role="danger" solid />
            </View>

            <Text style={styles.timelineLabel}>Risk trajectory</Text>
            <View style={styles.timeline}>
              {riskTimeline.map((item, index) => {
                const isDanger = item.severity === 'danger';
                const isWarning = item.severity === 'warning';
                
                let dotColor = colors.surfaceSubtle;
                let textColor = colors.textSecondary;
                let dateColor = colors.textMuted;
                let textWeight: any = typography.fontWeight.regular;

                if (isDanger) {
                  dotColor = colors.dangerFill;
                  textColor = colors.dangerText;
                  dateColor = colors.dangerText;
                  textWeight = typography.fontWeight.medium;
                } else if (isWarning) {
                  dotColor = colors.warningFill;
                }

                return (
                  <View key={index} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <Text style={[styles.timelineDate, { color: dateColor, fontWeight: textWeight }]}>{item.date}</Text>
                      <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                      {index !== riskTimeline.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text style={[styles.timelineText, { color: textColor, fontWeight: textWeight }]}>{item.text}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.aiCallout}>
              <IconChartBar size={18} color={colors.warningText} />
              <Text style={styles.aiCalloutText}>
                AI-flagged pattern: cardiometabolic cluster (T2DM, hypertension, dyslipidemia) preceding acute chest pain, flagged for cardiology review
              </Text>
            </View>
          </View>

          {/* Panel 2 — General health profile */}
          <View style={styles.panel}>
            <View style={styles.healthHeaderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>RI</Text>
              </View>
              <View>
                <Text style={styles.healthName}>Ramesh Iyer</Text>
                <Text style={styles.healthSubtitle}>58 · male · O+</Text>
                <Text style={styles.abhaText}>ABHA: XX-XXXX-9821</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <MetricCard label="BMI" value="27.4" />
              <MetricCard label="BP" value="142/90" />
              <MetricCard label="HbA1c" value="7.1%" />
            </View>

            <Text style={styles.conditionsLabel}>Known conditions</Text>
            <View style={styles.conditionsRow}>
              <Chip label="Type 2 diabetes" role="neutral" />
              <Chip label="Hypertension" role="neutral" />
            </View>

            <View style={styles.divider} />
            <Text style={styles.summaryTitle}>Pre-consultation summary</Text>
            <Text style={styles.summaryCaption}>Generated from today's intake conversation</Text>
            <Text style={styles.summaryNarrative}>
              Patient reports sudden chest pain roughly three hours before arrival, dull and pressure-like, radiating to the left arm, worse with exertion and eased by rest. Associated breathlessness noted. No similar episodes recalled by the patient.
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  toggleWrapper: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sliderWindow: {
    width: CARD_WIDTH,
    overflow: 'hidden',
  },
  sliderTrack: {
    flexDirection: 'row',
    width: CARD_WIDTH * 2,
  },
  panel: {
    width: CARD_WIDTH,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  timelineLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  timeline: {
    marginBottom: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 32,
  },
  timelineLeft: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 16,
    position: 'relative',
  },
  timelineDate: {
    fontSize: 11,
    marginTop: -2,
  },
  timelineDot: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    right: 7,
    top: 10,
    bottom: -10,
    width: 2,
    backgroundColor: colors.borderSubtle,
    zIndex: 1,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineText: {
    fontSize: 12,
    marginTop: -3,
    lineHeight: 18,
  },
  aiCallout: {
    flexDirection: 'row',
    backgroundColor: colors.warningBg,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  aiCalloutText: {
    flex: 1,
    fontSize: 11,
    color: colors.warningText,
    lineHeight: 16,
  },
  healthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
  },
  healthName: {
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  healthSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  abhaText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: spacing.md,
  },
  conditionsLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  conditionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.md,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  summaryCaption: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  summaryNarrative: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 19.2, // 1.6
  },
});
