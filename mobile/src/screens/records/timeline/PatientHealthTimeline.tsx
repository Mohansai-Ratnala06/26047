import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../theme';
import { TimelineEpisode, episodeApi } from '../../../api/episodeApi';
import { conversationApi } from '../../../api/conversationApi';
import { useTranslation } from '../../../i18n';
import { EpisodeTimelineNode } from './EpisodeTimelineNode';
import { TimelineSkeleton } from './TimelineSkeleton';

export interface PatientHealthTimelineProps {
  episodes: TimelineEpisode[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => Promise<any> | void;
  searchQuery?: string;
  onOpenRecordDocument?: (documentIdOrCode: string) => void;
}

export const PatientHealthTimeline: React.FC<PatientHealthTimelineProps> = ({
  episodes,
  loading,
  refreshing,
  error,
  onRefresh,
  searchQuery = '',
  onOpenRecordDocument,
}) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [loadingChildId, setLoadingChildId] = useState<string | null>(null);

  // Filter episodes by search query (chief complaint, doctor, status)
  const filteredEpisodes = useMemo(() => {
    const sorted = [...episodes].sort((a, b) => {
      const dateA = new Date(a.startedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.startedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (!searchQuery.trim()) {
      return sorted;
    }

    const q = searchQuery.trim().toLowerCase();
    return sorted.filter((ep) => {
      const complaintMatch = ep.chiefComplaint?.toLowerCase().includes(q);
      const codeMatch = ep.episodeCode?.toLowerCase().includes(q);
      const doctorMatch = ep.doctorId?.name?.toLowerCase().includes(q);
      const symptomMatch = ep.symptoms?.some((s) => s.name?.toLowerCase().includes(q));
      const notesMatch = ep.clinicalNotes?.toLowerCase().includes(q);
      return complaintMatch || codeMatch || doctorMatch || symptomMatch || notesMatch;
    });
  }, [episodes, searchQuery]);

  // Open AI Summary -> ClinicalResultsScreen
  const handleOpenAiSummary = useCallback(
    async (episode: TimelineEpisode) => {
      const epId = episode._id || episode.episodeId;
      if (!epId) return;

      try {
        setLoadingChildId(epId);
        // Fetch detailed episode data or conversation
        const epDetailRes: any = await episodeApi.getEpisodeById(epId);
        const epData = epDetailRes?.data || epDetailRes;

        let clinicalOutput: any = epData?.clinicalOutput || null;
        let conversationId: string | undefined;

        if (!clinicalOutput && Array.isArray(epData?.conversations) && epData.conversations.length > 0) {
          const validConv = epData.conversations.find(
            (c: any) => c.clinicalOutput && Object.keys(c.clinicalOutput).length > 0
          );
          if (validConv) {
            clinicalOutput = validConv.clinicalOutput;
            conversationId = validConv._id;
          }
        }

        // Fallback: direct conversation fetch by episode
        if (!clinicalOutput) {
          const convRes: any = await conversationApi.getConversationsByEpisode(epId);
          const convList = Array.isArray(convRes?.data)
            ? convRes.data
            : Array.isArray(convRes)
            ? convRes
            : [];
          const matched = convList.find(
            (c: any) => c.clinicalOutput && Object.keys(c.clinicalOutput).length > 0
          );
          if (matched) {
            clinicalOutput = matched.clinicalOutput;
            conversationId = matched._id;
          }
        }

        if (clinicalOutput) {
          navigation.navigate('ClinicalResults', {
            clinicalOutput,
            conversationId,
            source: 'health_timeline',
          });
        } else {
          // Construct lightweight preview narrative if no full AI bundle yet
          const fallbackOutput = {
            clinical_summary: {
              summary_narrative:
                episode.clinicalNotes ||
                `Clinical encounter for ${episode.chiefComplaint}. Patient reported symptoms with evaluation status: ${episode.status}.`,
              data_completeness: 'complete',
            },
            safety_findings: {
              immediate_attention_required: episode.triage?.level === 'urgent',
              red_flags: episode.triage?.redFlags || [],
            },
            risk_assessment: {
              risk_level: (episode.triage?.level || 'low').toUpperCase(),
            },
          };
          navigation.navigate('ClinicalResults', {
            clinicalOutput: fallbackOutput,
            source: 'health_timeline',
          });
        }
      } catch (err: any) {
        console.log('Unable to load AI summary:', err?.message || err);
        // Fallback navigation
        const fallbackOutput = {
          clinical_summary: {
            summary_narrative:
              episode.clinicalNotes ||
              `Clinical encounter for ${episode.chiefComplaint}. Recorded on ${new Date(
                episode.startedAt || episode.createdAt
              ).toLocaleDateString()}.`,
          },
        };
        navigation.navigate('ClinicalResults', {
          clinicalOutput: fallbackOutput,
          source: 'health_timeline',
        });
      } finally {
        setLoadingChildId(null);
      }
    },
    [navigation]
  );

  // Open Attached Records / Documents
  const handleOpenRecords = useCallback(
    async (episode: TimelineEpisode) => {
      const epId = episode._id || episode.episodeId;
      if (onOpenRecordDocument && epId) {
        onOpenRecordDocument(epId);
      }
    },
    [onOpenRecordDocument]
  );

  // Open Consents Tab
  const handleOpenConsents = useCallback(() => {
    navigation.navigate('Consultation');
  }, [navigation]);

  // Loading Skeleton State
  if (loading && !refreshing) {
    return <TimelineSkeleton />;
  }

  // Error State
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconCircle}>
          <Ionicons name="pulse-outline" size={32} color={colors.error} />
        </View>
        <Text style={styles.errorTitle}>Unable to load your health timeline</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onRefresh()}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Retry loading health timeline"
        >
          <Ionicons name="reload-outline" size={16} color={colors.primary} />
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty State
  if (filteredEpisodes.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.emptyIconCircle}>
          <Ionicons name="git-commit-outline" size={38} color={colors.primary} />
        </View>

        <Text style={styles.emptyTitle}>
          {searchQuery ? t('records.noRecordFound') : t('timeline.noEpisodes')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? t('records.noRecordTimelineSub')
            : t('timeline.noEpisodes')}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onRefresh()}
          disabled={refreshing}
          style={styles.emptyRefreshButton}
          accessibilityRole="button"
          accessibilityLabel={t('records.refreshRecordsBtn')}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.emptyRefreshButtonText}>{t('records.refreshRecordsBtn')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.timelineScroll}
      contentContainerStyle={styles.timelineContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Timeline Journey Header Label */}
      <View style={styles.journeyHeader}>
        <View style={styles.journeyHeaderIcon}>
          <Ionicons name="analytics-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.journeyHeaderCol}>
          <Text style={styles.journeyTitle}>Patient Health Journey</Text>
          <Text style={styles.journeySubtitle}>
            {filteredEpisodes.length} chronological episode{filteredEpisodes.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Episodes along Timeline Spine */}
      {filteredEpisodes.map((episode, index) => (
        <EpisodeTimelineNode
          key={episode._id || episode.episodeId || `ep-${index}`}
          episode={episode}
          isFirst={index === 0}
          isLast={index === filteredEpisodes.length - 1}
          onOpenAiSummary={handleOpenAiSummary}
          onOpenRecords={handleOpenRecords}
          onOpenConsents={handleOpenConsents}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 100, // ensure space above floating upload button and bottom navigation
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  journeyHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  journeyHeaderCol: {
    flex: 1,
  },
  journeyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  journeySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    minHeight: 380,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.mintWash,
    borderWidth: 1,
    borderColor: colors.mintAccent,
  },
  emptyRefreshButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 300,
  },
  errorIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
});
