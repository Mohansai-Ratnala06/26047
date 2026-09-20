import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../theme';
import { Badge } from '../../../components';
import { TimelineEpisode } from '../../../api/episodeApi';

export interface EpisodeTimelineNodeProps {
  episode: TimelineEpisode;
  isFirst: boolean;
  isLast: boolean;
  onOpenAiSummary: (episode: TimelineEpisode) => void;
  onOpenRecords: (episode: TimelineEpisode) => void;
  onOpenConsents: () => void;
  onOpenConsultation?: (episode: TimelineEpisode) => void;
}

interface ActionDatapoint {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  bgFill: string;
  iconTint: string;
  badge?: string;
  onPress: () => void;
}

function formatYearOrDate(dateStr?: string, resolvedStr?: string): string {
  if (!dateStr) return 'Recent';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const startFmt = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (resolvedStr) {
    const r = new Date(resolvedStr);
    if (!isNaN(r.getTime())) {
      const endFmt = r.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${startFmt} – ${endFmt}`;
    }
  }
  return startFmt;
}

function getPhaseLabel(type?: string, status?: string, triageLevel?: string): string {
  // Urgent or Emergency care
  if (type === 'emergency' || triageLevel === 'urgent') {
    return 'Acute Care Phase';
  }
  // Clinical escalation or physician consultation
  if (type === 'consultation' || status === 'escalated' || triageLevel === 'high') {
    return 'Consultation Phase';
  }
  switch (type) {
    case 'symptom':
      return 'Symptom Phase';
    case 'followup':
      return 'Follow-up Phase';
    case 'chronic_condition':
      return 'Chronic Care Phase';
    default:
      return 'Health Phase';
  }
}

function getStatusBadge(status?: string): { label: string; variant: 'mint' | 'warning' | 'neutral' | 'error' } {
  switch (status) {
    case 'open':
      return { label: 'Active', variant: 'mint' };
    case 'under_review':
      return { label: 'Under Review', variant: 'warning' };
    case 'resolved':
      return { label: 'Resolved', variant: 'mint' };
    case 'escalated':
      return { label: 'Escalated', variant: 'error' };
    case 'closed':
    default:
      return { label: 'Completed', variant: 'neutral' };
  }
}

export const EpisodeTimelineNode: React.FC<EpisodeTimelineNodeProps> = ({
  episode,
  isFirst,
  isLast,
  onOpenAiSummary,
  onOpenRecords,
  onOpenConsents,
  onOpenConsultation,
}) => {
  const enterFadeAnim = useRef(new Animated.Value(0)).current;
  const enterScaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    let isReducedMotion = false;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      isReducedMotion = Boolean(enabled);
    });

    Animated.parallel([
      Animated.timing(enterFadeAnim, {
        toValue: 1,
        duration: isReducedMotion ? 50 : 300,
        useNativeDriver: true,
      }),
      Animated.spring(enterScaleAnim, {
        toValue: 1,
        speed: 16,
        bounciness: isReducedMotion ? 0 : 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [enterFadeAnim, enterScaleAnim]);

  const dateLabel = formatYearOrDate(episode.startedAt || episode.createdAt, episode.resolvedAt);
  const statusInfo = getStatusBadge(episode.status);
  const phaseLabel = getPhaseLabel(episode.type, episode.status, episode.triage?.level);
  const doctorName = episode.doctorId?.name ? `Dr. ${episode.doctorId.name}` : undefined;
  const department = episode.doctorId?.department;

  // Resolve genuine patient chief complaint for the primary header line
  const displayChiefComplaint = useMemo(() => {
    // 1. Check if structured clinical diagnosis/problem exists in clinicalOutput
    const clinOutput = episode.clinicalOutput as any;
    const clinicalTitle =
      clinOutput?.pre_consultation_summary?.highlighted_problem ||
      clinOutput?.pre_consultation_report?.doctorSummarySOAP?.highlightedProblem ||
      clinOutput?.clinical_summary?.soap?.highlightedProblem ||
      clinOutput?.clinical_summary?.primary_concern ||
      clinOutput?.clinical_case?.chief_complaint;

    if (clinicalTitle && typeof clinicalTitle === 'string' && clinicalTitle.trim().length > 1 && !/[\u0900-\u0D7F]/.test(clinicalTitle)) {
      return clinicalTitle.trim();
    }

    const raw = episode.chiefComplaint?.trim();
    const hasIndicScript = /[\u0900-\u0D7F]/.test(raw || '');
    const isPlaceholderOrConversational =
      !raw ||
      hasIndicScript ||
      raw.toLowerCase().includes('voice consultation') ||
      raw.toLowerCase().includes('ai triage') ||
      raw.toLowerCase().includes('clinical consultation') ||
      raw.toLowerCase().includes('symptom intake') ||
      raw.toLowerCase().includes('health intake') ||
      raw.toLowerCase() === 'symptom' ||
      raw.toLowerCase() === 'pain' ||
      raw.endsWith('.') ||
      raw.endsWith('?');

    if (!isPlaceholderOrConversational && raw) {
      return raw;
    }

    // Check symptoms array
    if (Array.isArray(episode.symptoms) && episode.symptoms.length > 0) {
      const names = episode.symptoms
        .map((s) => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
      if (names.length > 0) {
        return names.join(', ');
      }
    }

    if (episode.clinicalNotes && episode.clinicalNotes.length < 60 && !episode.clinicalNotes.includes('[')) {
      return episode.clinicalNotes;
    }

    return 'Clinical Health Intake & Evaluation';
  }, [episode.chiefComplaint, episode.clinicalOutput, episode.symptoms, episode.clinicalNotes]);

  // Descriptive subtitle to reinforce clinical phase context
  const contextSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (episode.duration) {
      parts.push(`Duration: ${episode.duration}`);
    }
    if (Array.isArray(episode.symptoms) && episode.symptoms.length > 0) {
      const names = episode.symptoms
        .map((s) => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
      if (names.length > 0 && names.join(', ') !== displayChiefComplaint) {
        parts.push(`Reported: ${names.join(', ')}`);
      }
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  }, [episode.duration, episode.symptoms, displayChiefComplaint]);

  const isAiPreConsult = Boolean(
    episode.availableData?.aiSummary ||
    episode.clinicalOutput ||
    (episode.clinicalNotes && episode.clinicalNotes.includes('[PRE-CONSULTATION SUMMARY'))
  );

  const available = episode.availableData || {
    aiSummary: isAiPreConsult,
    records: Boolean(episode.counts?.records && episode.counts.records > 0),
    consents: Boolean(episode.counts?.consents && episode.counts.consents > 0),
    consultation: Boolean(
      (doctorName || (episode.counts?.assessments && episode.counts.assessments > 0)) &&
      (!isAiPreConsult || Boolean(doctorName))
    ),
    documents: Boolean(episode.counts?.documents && episode.counts.documents > 0),
    investigations: Boolean(episode.counts?.investigations && episode.counts.investigations > 0),
    prescriptions: Boolean(episode.counts?.prescriptions && episode.counts.prescriptions > 0),
    vitals: false,
  };

  const counts = episode.counts || {
    records: 0,
    documents: 0,
    prescriptions: 0,
    investigations: 0,
    consents: 0,
  };

  // Build the list of available actions dynamically (rendered ONLY if data exists!)
  const actionItems = useMemo<ActionDatapoint[]>(() => {
    const items: ActionDatapoint[] = [];

    // 1. AI Pre-Consultation
    if (available.aiSummary || isAiPreConsult) {
      items.push({
        id: 'ai-summary',
        type: 'ai',
        title: 'AI Pre-Consultation',
        subtitle: 'Case-taking narrative & safety findings',
        iconName: 'sparkles',
        bgFill: colors.primary,
        iconTint: '#FFFFFF',
        badge: 'Available',
        onPress: () => onOpenAiSummary(episode),
      });
    }

    // 2. Doctor Consultation (ONLY when a genuine physician consultation was conducted)
    // Do NOT show doctor consultation if it was purely an AI pre-consultation report, and do not duplicate.
    const isRealDoctorConsultation =
      available.consultation &&
      (Boolean(doctorName) || (episode.counts?.assessments && episode.counts.assessments > 0));

    if (isRealDoctorConsultation) {
      items.push({
        id: 'consultation',
        type: 'consultation',
        title: 'Doctor Consultation',
        subtitle: doctorName ? `${doctorName}` : 'Clinical assessment recorded',
        iconName: 'medkit',
        bgFill: colors.primaryLight,
        iconTint: '#FFFFFF',
        onPress: () => {
          if (onOpenConsultation) {
            onOpenConsultation(episode);
          } else if (onOpenRecords) {
            onOpenRecords(episode);
          }
        },
      });
    }

    // 3. Health Documents & Reports
    if (available.records || available.documents || counts.records > 0) {
      items.push({
        id: 'documents',
        type: 'documents',
        title: 'Health Documents',
        subtitle: `${counts.records || 1} attached medical file(s)`,
        iconName: 'document-text',
        bgFill: colors.mintDark,
        iconTint: '#FFFFFF',
        onPress: () => onOpenRecords(episode),
      });
    }

    // 4. Prescriptions & Treatment
    if (available.prescriptions || counts.prescriptions > 0) {
      items.push({
        id: 'prescriptions',
        type: 'prescriptions',
        title: 'Prescriptions',
        subtitle: `${counts.prescriptions || 1} prescribed medication(s)`,
        iconName: 'receipt',
        bgFill: '#D97706', // Warm Amber
        iconTint: '#FFFFFF',
        onPress: () => onOpenRecords(episode),
      });
    }

    // 5. Investigations & Labs
    if (available.investigations || counts.investigations > 0) {
      items.push({
        id: 'investigations',
        type: 'investigations',
        title: 'Diagnostic Labs',
        subtitle: `${counts.investigations || 1} lab test result(s)`,
        iconName: 'flask',
        bgFill: '#0284C7', // Clinical Blue
        iconTint: '#FFFFFF',
        onPress: () => onOpenRecords(episode),
      });
    }

    // 6. Vital Signs
    if (available.vitals) {
      items.push({
        id: 'vitals',
        type: 'vitals',
        title: 'Vital Signs',
        subtitle: 'Encounter vitals recorded',
        iconName: 'heart',
        bgFill: '#E11D48', // Rose
        iconTint: '#FFFFFF',
        onPress: () => onOpenRecords(episode),
      });
    }

    // 7. Consents
    if (available.consents) {
      items.push({
        id: 'consents',
        type: 'consents',
        title: 'Consents',
        subtitle: 'ABDM authorized access',
        iconName: 'shield-checkmark',
        bgFill: colors.mintAccent,
        iconTint: '#FFFFFF',
        onPress: onOpenConsents,
      });
    }

    return items;
  }, [available, counts, episode, onOpenAiSummary, onOpenRecords, onOpenConsents, onOpenConsultation, doctorName, isAiPreConsult]);

  // Group actions into left/right rows
  const actionRows = useMemo(() => {
    const rows: { left?: ActionDatapoint; right?: ActionDatapoint }[] = [];
    for (let i = 0; i < actionItems.length; i += 2) {
      rows.push({
        left: actionItems[i],
        right: actionItems[i + 1],
      });
    }
    return rows;
  }, [actionItems]);

  return (
    <Animated.View
      style={[
        styles.episodeContainer,
        {
          opacity: enterFadeAnim,
          transform: [{ scale: enterScaleAnim }],
        },
      ]}
    >
      {/* 1. Top Section of the Central Line (connecting from above) */}
      <View style={styles.centerSpineSegment}>
        <View style={[styles.centerLineTop, isFirst && styles.centerLineHidden]} />

        {/* Central Chronological Node with Outer Ring */}
        <View style={styles.centerNodeOuter}>
          <View style={styles.centerNodeCore}>
            <Ionicons name="time" size={12} color="#FFFFFF" />
          </View>
        </View>

        {/* Date / Timeframe Tag centered right on the timeline (Matching 2010-2020 in reference) */}
        <View style={styles.centerDateBadge}>
          <Text style={styles.centerDateText}>{dateLabel}</Text>
        </View>

        <View style={styles.centerLinePostDate} />
      </View>

      {/* 2. Chief Complaint Datapoint Banner (Centered on Timeline) */}
      <View style={styles.complaintBannerWrapper}>
        <View style={styles.complaintBannerCard}>
          {/* Phase Badge & Status (No Technical Episode ID!) */}
          <View style={styles.complaintTopRow}>
            <View style={styles.phaseBadge}>
              <Ionicons name="medical-outline" size={13} color={colors.primary} />
              <Text style={styles.phaseBadgeText}>{phaseLabel}</Text>
            </View>
            <Badge label={statusInfo.label} variant={statusInfo.variant} size="sm" />
          </View>

          {/* Chief Complaint: The prominent header line of this clinical phase */}
          <Text style={styles.complaintTitle} numberOfLines={2}>
            {displayChiefComplaint}
          </Text>

          {/* Clinical Context: Duration, Symptoms */}
          {contextSubtitle ? (
            <View style={styles.contextRow}>
              <Ionicons name="pulse" size={12} color={colors.mintDark} />
              <Text style={styles.contextText} numberOfLines={1}>
                {contextSubtitle}
              </Text>
            </View>
          ) : null}

          {/* Doctor Consultation Info if available */}
          {doctorName ? (
            <View style={styles.doctorRow}>
              <Ionicons name="medkit-outline" size={13} color={colors.primary} />
              <Text style={styles.doctorText} numberOfLines={1}>
                {doctorName} {department ? `(${department})` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 3. Action Datapoints Symmetrically Arranged on Left and Right of Center Line */}
      {actionRows.length > 0 ? (
        <View style={styles.actionsTreeContainer}>
          {actionRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.actionTreeRow}>
              {/* Continuous Center Vertical Line running through this row */}
              <View style={styles.rowCenterLine} />

              {/* Left Action Node */}
              <View style={styles.actionColumnLeft}>
                {row.left ? (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={row.left.onPress}
                    style={styles.actionDatapointTouch}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.left.title}: ${row.left.subtitle}`}
                  >
                    {/* Circle Icon Badge (Matching the orange circles in reference, in VAIDYAARC theme) */}
                    <View style={[styles.actionCircleBadge, { backgroundColor: row.left.bgFill }]}>
                      <Ionicons name={row.left.iconName} size={24} color={row.left.iconTint} />
                    </View>

                    {/* Text Label & Description Below the Circle */}
                    <Text style={styles.actionTitleText} numberOfLines={1}>
                      {row.left.title}
                    </Text>
                    <Text style={styles.actionSubtitleText} numberOfLines={2}>
                      {row.left.subtitle}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Central Junction Marker on the Line */}
              <View style={styles.centerJunctionMarker}>
                <View style={styles.junctionDot} />
              </View>

              {/* Right Action Node */}
              <View style={styles.actionColumnRight}>
                {row.right ? (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={row.right.onPress}
                    style={styles.actionDatapointTouch}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.right.title}: ${row.right.subtitle}`}
                  >
                    {/* Circle Icon Badge */}
                    <View style={[styles.actionCircleBadge, { backgroundColor: row.right.bgFill }]}>
                      <Ionicons name={row.right.iconName} size={24} color={row.right.iconTint} />
                    </View>

                    {/* Text Label & Description Below the Circle */}
                    <Text style={styles.actionTitleText} numberOfLines={1}>
                      {row.right.title}
                    </Text>
                    <Text style={styles.actionSubtitleText} numberOfLines={2}>
                      {row.right.subtitle}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  // If odd number of actions, display a subtle spacer
                  <View style={styles.actionEmptyPlaceholder} />
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        /* If no actions exist for this episode yet, show clean subtle status */
        <View style={styles.noActionsNotice}>
          <Text style={styles.noActionsText}>Clinical encounter recorded. Documents will appear as processed.</Text>
        </View>
      )}

      {/* 4. Bottom Line Segment to connect to the next episode */}
      {!isLast ? (
        <View style={styles.bottomSpineConnector}>
          <View style={styles.bottomCenterLine} />
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  episodeContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  centerSpineSegment: {
    width: '100%',
    alignItems: 'center',
  },
  centerLineTop: {
    width: 2,
    height: 24,
    backgroundColor: colors.primary,
  },
  centerLineHidden: {
    backgroundColor: 'transparent',
    height: 10,
  },
  centerNodeOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mintWash,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  centerNodeCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDateBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    ...shadows.soft,
  },
  centerDateText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  centerLinePostDate: {
    width: 2,
    height: 18,
    backgroundColor: colors.primary,
  },
  complaintBannerWrapper: {
    width: '100%',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: -2,
    marginBottom: spacing.md,
    zIndex: 2,
  },
  complaintBannerCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    ...shadows.card,
  },
  complaintTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mintWash,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: 2,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  contextText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  doctorText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  actionsTreeContainer: {
    width: '100%',
    position: 'relative',
    marginTop: 4,
  },
  actionTreeRow: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rowCenterLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.primary,
    zIndex: 1,
  },
  actionColumnLeft: {
    flex: 1,
    paddingRight: spacing.lg,
    paddingLeft: spacing.xs,
    alignItems: 'center',
    zIndex: 2,
  },
  actionColumnRight: {
    flex: 1,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    alignItems: 'center',
    zIndex: 2,
  },
  centerJunctionMarker: {
    position: 'absolute',
    left: '50%',
    top: 24,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.mintWash,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  junctionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  actionDatapointTouch: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 150,
  },
  actionCircleBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.elevated,
  },
  actionTitleText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
  },
  actionSubtitleText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  actionEmptyPlaceholder: {
    width: 54,
    height: 54,
  },
  noActionsNotice: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  noActionsText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bottomSpineConnector: {
    width: '100%',
    alignItems: 'center',
    marginTop: -8,
  },
  bottomCenterLine: {
    width: 2,
    height: 36,
    backgroundColor: colors.primary,
  },
});
