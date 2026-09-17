import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { Badge, Button, LoadingState, ErrorState } from '../../components';
import { useTranslation } from '../../i18n';
import { apiClient } from '../../api/apiClient';
import { episodeApi, TimelineEpisode } from '../../api/episodeApi';
import { documentApi } from '../../api/documentApi';
import { useAuthStore } from '../../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { PatientHealthTimeline } from './timeline';
import { DocumentUploadWorkflowModal } from './upload/DocumentUploadWorkflowModal';
import { SmartReportView } from './upload/SmartReportView';
import { OriginalReportView } from './upload/OriginalReportView';

// ==========================================
// Types
// ==========================================

export type RecordCategoryTab = 'timeline' | 'uploaded' | 'linked';

export interface UnifiedRecord {
  id: string;
  code: string;
  facilityName: string;
  doctorName?: string;
  documentType: string;
  rawType?: string;
  category: 'linked' | 'uploaded';
  statusBadge: 'Linked Record' | 'Self Uploaded';
  date: string;
  rawDate?: string;
  verificationStatus?: string;
  extractionStatus?: string;
  diagnoses?: string[];
  medications?: string[];
  investigations?: string[];
  procedures?: string[];
  immunizations?: string[];
  tests?: Array<{ test_name: string; result: string; unit?: string | null; reference_range?: string | null }>;
  abnormalValues?: string[];
  vitals?: Array<{ parameter: string; value: string; unit?: string | null }>;
  advice?: string[];
  safetyAlerts?: Array<{ severity: string; type: string; message: string }>;
  brainAnalysis?: {
    clinicalSummary?: string;
    riskLevel?: 'low' | 'moderate' | 'high' | 'urgent' | string;
    redFlags?: string[];
    suggestedNextSteps?: string[];
    carePlanHighlights?: string[];
    rawAnalysis?: any;
  };
  clinicalNotes?: string;
  storageInfo?: {
    size?: number;
    contentType?: string;
    bucket?: string;
    fileName?: string;
  };
  extractedData?: any;
}

// ==========================================
// Helper Functions
// ==========================================

function formatRecordDate(dateValue?: string | Date): string {
  if (!dateValue) return 'Date not specified';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDocumentType(rawType?: string): string {
  if (!rawType) return 'Health Document';
  const typeMap: Record<string, string> = {
    prescription: 'Prescription',
    laboratory_report: 'Laboratory Report',
    discharge_summary: 'Discharge Summary',
    imaging: 'Diagnostic Imaging',
    consultation_note: 'Consultation Note',
    other: 'Health Document',
    symptom: 'Clinical Record',
    consultation: 'Consultation Episode',
    followup: 'Follow-up Record',
    chronic_condition: 'Chronic Condition Record',
    emergency: 'Emergency Summary',
  };
  return typeMap[rawType.toLowerCase()] || rawType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDocumentIconName(type?: string): keyof typeof Ionicons.glyphMap {
  const t = (type || '').toLowerCase();
  if (t.includes('prescription')) return 'receipt-outline';
  if (t.includes('lab') || t.includes('pathology')) return 'flask-outline';
  if (t.includes('discharge')) return 'clipboard-outline';
  if (t.includes('imaging') || t.includes('scan') || t.includes('x-ray')) return 'scan-outline';
  return 'document-text-outline';
}

// ==========================================
// Empty State Icon (Matching SWASTHYA-SETU vector visual language)
// ==========================================

const DocumentEmptyIcon: React.FC = () => {
  return (
    <View style={styles.emptyDocIconContainer}>
      {/* Back Document Outline */}
      <View style={styles.emptyDocBack} />

      {/* Front Document with lines */}
      <View style={styles.emptyDocFront}>
        <View style={[styles.emptyDocLine, { width: 22 }]} />
        <View style={[styles.emptyDocLine, { width: 34 }]} />
        <View style={[styles.emptyDocLine, { width: 18 }]} />
      </View>

      {/* Magnifying Glass with X */}
      <View style={styles.emptyMagnifierWrapper}>
        <View style={styles.emptyMagnifierCircle}>
          <Ionicons name="close" size={16} color="#8E9DAE" />
        </View>
        <View style={styles.emptyMagnifierHandle} />
      </View>
    </View>
  );
};

// ==========================================
// Record Card Component
// ==========================================

interface RecordCardProps {
  record: UnifiedRecord;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onViewDetails: (record: UnifiedRecord) => void;
  onOptionsPress: (record: UnifiedRecord) => void;
}

const RecordCard: React.FC<RecordCardProps> = ({
  record,
  isBookmarked,
  onToggleBookmark,
  onViewDetails,
  onOptionsPress,
}) => {
  const { t } = useTranslation();
  const iconName = getDocumentIconName(record.documentType);
  const statusBadge = record.category === 'uploaded' ? t('records.selfUploadedBadge') : t('records.linkedBadge');
  const sourceLabel = record.category === 'uploaded' ? t('records.documentSource') : t('records.facilityName');

  return (
    <View style={styles.cardContainer}>
      {/* Top Row: Icon + Facility Name + Badge + 3-Dots */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconWrapper}>
          <Ionicons name={iconName} size={22} color={colors.primary} />
        </View>

        <View style={styles.cardFacilityCol}>
          <Text style={styles.cardMetaLabel}>
            {sourceLabel}
          </Text>
          <Text style={styles.cardFacilityName} numberOfLines={1}>
            {record.facilityName}
          </Text>
        </View>

        <View style={styles.cardHeaderRightActions}>
          <Badge
            label={statusBadge}
            variant="mint"
            size="sm"
            style={styles.cardStatusBadge}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOptionsPress(record)}
            style={styles.cardOverflowBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.moreOptions')}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Middle Row: Patient ref number + Bookmark */}
      <View style={styles.cardFieldRow}>
        <View style={styles.cardFieldCol}>
          <Text style={styles.cardMetaLabel}>{t('records.patientRefNumber')}</Text>
          <Text style={styles.cardPatientRef} numberOfLines={1}>
            {record.code}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onToggleBookmark(record.id)}
          style={styles.bookmarkBtn}
          accessibilityRole="button"
          accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark record'}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isBookmarked ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Document Type Row */}
      <View style={styles.cardFieldRow}>
        <View style={styles.cardFieldCol}>
          <Text style={styles.cardMetaLabel}>{t('records.healthDocumentType')}</Text>
          <Text style={styles.cardDocumentType} numberOfLines={1}>
            {record.documentType}
          </Text>
        </View>
      </View>

      {/* Bottom Row: Date + View Records Button */}
      <View style={styles.cardFooterRow}>
        <View style={styles.cardDateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.cardDateText}>{record.date}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => onViewDetails(record)}
          style={styles.viewRecordsBtn}
          accessibilityRole="button"
          accessibilityLabel={`View records for ${record.facilityName}`}
        >
          <Text style={styles.viewRecordsBtnText}>{t('records.viewRecordsBtn')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==========================================
// Main Screen Component
// ==========================================

export const RecordsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // State
  const [activeTab, setActiveTab] = useState<RecordCategoryTab>('timeline');
  const [timelineEpisodes, setTimelineEpisodes] = useState<TimelineEpisode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & UI Controls
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailTab, setDetailTab] = useState<'smart' | 'original'>('smart');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [linkInfoModalVisible, setLinkInfoModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  // Filters & Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // ==========================================
  // Data Fetching
  // ==========================================

  const fetchRecords = useCallback(async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const unified: UnifiedRecord[] = [];

      // 1. Fetch real documents from /documents endpoint
      try {
        const docRes: any = await apiClient.get('/documents');
        const docList = Array.isArray(docRes?.data)
          ? docRes.data
          : Array.isArray(docRes)
          ? docRes
          : [];

        docList.forEach((doc: any) => {
          const rawHospital = (doc.source?.hospital || doc.source?.facility || '').trim();
          const isGenericSelf =
            !rawHospital ||
            rawHospital.toLowerCase() === 'self uploaded' ||
            rawHospital.toLowerCase() === 'self uploaded document' ||
            rawHospital.toLowerCase() === 'patient uploaded';

          // A document is a linked record ONLY if explicitly linked from ABDM or an external healthcare provider
          const isLinked =
            doc.storage?.provider === 'abdm' ||
            doc.source?.origin === 'abdm' ||
            doc.source?.origin === 'linked' ||
            doc.source?.origin === 'hospital_linked';

          const category: 'linked' | 'uploaded' = isLinked ? 'linked' : 'uploaded';
          const statusBadge: 'Linked Record' | 'Self Uploaded' = isLinked ? 'Linked Record' : 'Self Uploaded';

          const facilityName = !isGenericSelf
            ? rawHospital
            : (isLinked ? 'Linked Healthcare Facility' : 'Self Uploaded Document');

          unified.push({
            id: doc._id || doc.documentCode || Math.random().toString(),
            code: doc.documentCode || doc.patientRefNumber || 'REF-UNLINKED',
            facilityName,
            doctorName: doc.source?.doctor,
            documentType: formatDocumentType(doc.documentType),
            rawType: doc.documentType,
            category,
            statusBadge,
            date: formatRecordDate(doc.source?.documentDate || doc.createdAt),
            rawDate: doc.source?.documentDate || doc.createdAt,
            verificationStatus: doc.verification?.status || 'unverified',
            extractionStatus: doc.extractionStatus || 'pending',
            diagnoses: doc.extractedData?.diagnoses,
            medications: doc.extractedData?.medications,
            investigations: doc.extractedData?.investigations,
            procedures: doc.extractedData?.procedures,
            immunizations: doc.extractedData?.immunizations,
            tests: doc.extractedData?.tests,
            abnormalValues: doc.extractedData?.abnormalValues,
            vitals: doc.extractedData?.vitals,
            advice: doc.extractedData?.advice,
            safetyAlerts: doc.safetyAlerts,
            brainAnalysis: doc.brainAnalysis,
            storageInfo: doc.storage,
            extractedData: doc.extractedData,
          });
        });
      } catch (docErr) {
        console.log('Documents fetch note:', docErr);
      }

      // 2. Fetch real episodes from /episodes endpoint
      try {
        const epRes: any = await episodeApi.getEpisodes();
        const epList = Array.isArray(epRes?.data)
          ? epRes.data
          : Array.isArray(epRes)
          ? epRes
          : [];

        setTimelineEpisodes(epList);

        epList.forEach((ep: any) => {
          const doctorName =
            typeof ep.doctorId === 'object' && ep.doctorId?.name
              ? ep.doctorId.name
              : undefined;

          const clinicalOutput = ep.clinicalOutput;
          const preConsult = clinicalOutput?.pre_consultation_summary;
          const soap = preConsult?.soap;
          const hpi = preConsult?.history_of_present_illness?.structured_data;
          const safetySummary = clinicalOutput?.ayurveda_recommendation?.safety_findings_summary;
          const blockedReasons = clinicalOutput?.ayurveda_recommendation?.blocked_reasons || [];
          const remedies = clinicalOutput?.ayurveda_recommendation?.remedies_tracked || ep.remediesTracked || [];

          // Parse clinicalNotes regex fallback if clinicalOutput is missing or partial
          const notes = ep.clinicalNotes || '';
          const notesSeverityMatch = notes.match(/Severity:\s*(\d+)\/100/i);
          const notesSoapAssessmentMatch = notes.match(/SOAP Assessment:\s*([^\n\r]+)/i);
          const notesSoapPlanMatch = notes.match(/SOAP Plan:\s*([^\n\r]+)/i);
          const notesSoapSubjectiveMatch = notes.match(/SOAP Subjective:\s*([^\n\r]+)/i);
          const notesHpiMatch = notes.match(/HPI:\s*([^\n\r]+)/i);
          const notesRemediesMatch = notes.match(/Remedies Attempted:\s*([^\n\r]+)/i);

          const severityScore =
            safetySummary?.severity_score ??
            (notesSeverityMatch ? Number(notesSeverityMatch[1]) : undefined);

          // 1. Diagnoses / Clinical Findings
          const diagnoses: string[] = [];
          if (soap?.assessment) {
            diagnoses.push(soap.assessment);
          } else if (notesSoapAssessmentMatch?.[1]?.trim()) {
            diagnoses.push(notesSoapAssessmentMatch[1].trim());
          }
          if (soap?.highlightedProblem && !diagnoses.includes(soap.highlightedProblem)) {
            diagnoses.unshift(soap.highlightedProblem);
          } else if (
            ep.chiefComplaint &&
            !diagnoses.some((d) => d.toLowerCase().includes(ep.chiefComplaint.toLowerCase())) &&
            !ep.chiefComplaint.toLowerCase().includes('consultation') &&
            !ep.chiefComplaint.toLowerCase().includes('general health assessment')
          ) {
            diagnoses.unshift(ep.chiefComplaint);
          }

          // 2. Doctor's Advice / Care Plan
          const advice: string[] = [];
          if (soap?.plan) {
            advice.push(soap.plan);
          } else if (notesSoapPlanMatch?.[1]?.trim()) {
            advice.push(notesSoapPlanMatch[1].trim());
          }
          if (Array.isArray(blockedReasons) && blockedReasons.length > 0) {
            blockedReasons.forEach((br: string) => {
              if (!advice.includes(br)) advice.push(br);
            });
          }

          // 3. Vitals & Clinical Observations
          const vitals: Array<{ parameter: string; value: string; unit?: string | null }> = [];
          if (severityScore != null) {
            const num = Number(severityScore);
            const label =
              num >= 80
                ? 'Urgent / Critical'
                : num >= 60
                ? 'High Severity (Consultation Required)'
                : num >= 35
                ? 'Moderate'
                : 'Mild';
            vitals.push({
              parameter: 'Severity Score',
              value: `${severityScore}/100 - ${label}`,
            });
          }
          if (hpi?.duration) {
            vitals.push({ parameter: 'Symptom Duration', value: hpi.duration });
          }
          if (hpi?.location) {
            vitals.push({ parameter: 'Affected Area', value: hpi.location });
          }
          if (hpi?.nature_of_pain) {
            vitals.push({ parameter: 'Nature of Pain', value: hpi.nature_of_pain });
          }
          if (Array.isArray(hpi?.associated_symptoms) && hpi.associated_symptoms.length > 0) {
            vitals.push({
              parameter: 'Associated Symptoms',
              value: hpi.associated_symptoms.join(', '),
            });
          } else if (Array.isArray(ep.symptoms) && ep.symptoms.length > 0) {
            const symNames = ep.symptoms.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
            if (symNames.length > 0) {
              vitals.push({ parameter: 'Reported Symptoms', value: symNames.join(', ') });
            }
          }

          // 4. Medications & Tracked Remedies
          const medications: string[] = [];
          if (Array.isArray(remedies) && remedies.length > 0) {
            remedies.forEach((r: any) => {
              const rName = r.remedyName || r.remedy;
              if (rName) {
                const statusStr = r.status ? `[${r.status.toUpperCase()}]` : '';
                const reliefStr =
                  r.reliefReported && r.reliefReported !== 'pending'
                    ? ` - Relief: ${r.reliefReported}`
                    : '';
                medications.push(`${rName} ${statusStr}${reliefStr}`.trim());
              }
            });
          } else if (notesRemediesMatch?.[1]?.trim() && notesRemediesMatch[1].trim() !== 'None') {
            notesRemediesMatch[1]
              .split(',')
              .map((r: string) => r.trim())
              .filter(Boolean)
              .forEach((r: string) => medications.push(r));
          }

          // 5. Safety Alerts
          const safetyAlerts: Array<{ severity: string; type: string; message: string }> = [];
          if (
            safetySummary?.immediate_attention_required ||
            safetySummary?.red_flag_status === 'red_flags_detected' ||
            (severityScore != null && severityScore >= 60)
          ) {
            safetyAlerts.push({
              severity: 'HIGH',
              type: 'CLINICAL_ESCALATION',
              message:
                'High severity clinical escalation detected during intake. Immediate in-person physician consultation recommended.',
            });
          }
          if (Array.isArray(ep.triage?.redFlags) && ep.triage.redFlags.length > 0) {
            ep.triage.redFlags.forEach((rf: string) => {
              safetyAlerts.push({
                severity: 'HIGH',
                type: 'RED_FLAG',
                message: rf,
              });
            });
          }

          // 6. Clinical Brain Intelligence Analysis Card
          const riskLevel =
            (safetySummary?.risk_level ||
              ep.triage?.level ||
              (severityScore != null && severityScore >= 80
                ? 'urgent'
                : severityScore != null && severityScore >= 60
                ? 'high'
                : 'moderate')
            ).toLowerCase();

          const brainAnalysis = {
            clinicalSummary:
              soap?.subjective ||
              soap?.assessment ||
              (notesSoapSubjectiveMatch?.[1] ? notesSoapSubjectiveMatch[1].trim() : undefined) ||
              (notesHpiMatch?.[1] ? `HPI: ${notesHpiMatch[1].trim()}` : undefined) ||
              ep.clinicalNotes?.slice(0, 300) ||
              'Clinical Pre-Consultation assessment completed by Smart Health Companion.',
            riskLevel: riskLevel as any,
            redFlags:
              ep.triage?.redFlags?.length
                ? ep.triage.redFlags
                : blockedReasons.length
                ? blockedReasons
                : undefined,
            suggestedNextSteps: soap?.plan
              ? [soap.plan]
              : notesSoapPlanMatch?.[1]
              ? [notesSoapPlanMatch[1].trim()]
              : undefined,
            carePlanHighlights:
              hpi?.duration || hpi?.nature_of_pain
                ? [
                    `Onset: ${hpi.duration || 'Acute'}`,
                    `Pain Character: ${hpi.nature_of_pain || 'Reported'}`,
                    `Mobility: ${
                      hpi.associated_symptoms?.some((s: string) => s.includes('నడవలేకపోవడం'))
                        ? 'Loss of ambulation / unable to walk'
                        : 'Functional impairment reported'
                    }`,
                  ]
                : undefined,
          };

          // 7. Patient Display Name & Extracted Data Structure
          const patientDisplayName =
            user?.name ||
            (typeof ep.patientId === 'object' &&
              (ep.patientId?.demographics?.firstName
                ? `${ep.patientId.demographics.firstName} ${ep.patientId.demographics.lastName || ''}`.trim()
                : ep.patientId?.name)) ||
            'Ratnala Mohan Sai';

          const facilityDisplayName = doctorName
            ? `Dr. ${doctorName} Consultation`
            : 'Smart Health Companion (VaidyaArc AI)';

          const extractedData = {
            patientName: patientDisplayName,
            reportedDate: formatRecordDate(ep.startedAt || ep.createdAt),
            clinicName: facilityDisplayName,
            healthDocumentType: 'AI Pre-Consultation Summary',
            diagnoses,
            medications,
            advice,
            vitals,
            safetyAlerts,
          };

          unified.push({
            id: ep._id || ep.episodeCode || Math.random().toString(),
            code: ep.episodeCode || 'EP-RECORD',
            facilityName: facilityDisplayName,
            doctorName,
            documentType: 'AI Pre-Consultation Summary',
            rawType: ep.type,
            category: 'linked',
            statusBadge: 'Linked Record',
            date: formatRecordDate(ep.startedAt || ep.createdAt),
            rawDate: ep.startedAt || ep.createdAt,
            verificationStatus: 'verified',
            extractionStatus: 'completed',
            clinicalNotes: ep.clinicalNotes,
            diagnoses,
            medications,
            advice,
            vitals,
            safetyAlerts,
            brainAnalysis,
            extractedData,
          });
        });
      } catch (epErr) {
        console.log('Episodes fetch note:', epErr);
      }

      setRecords(unified);
      return unified;
    } catch (err: any) {
      console.log('Failed to fetch records:', err?.message || err);
      setError('Unable to load records. Please verify your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ==========================================
  // Filtering & Search
  // ==========================================

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // Category Tab Filter
      if (activeTab === 'uploaded' && item.category !== 'uploaded') {
        return false;
      }
      if (activeTab === 'linked' && item.category !== 'linked') {
        return false;
      }

      // Type Filter
      if (selectedTypeFilter !== 'all') {
        const matchesType =
          item.rawType?.toLowerCase() === selectedTypeFilter.toLowerCase() ||
          item.documentType.toLowerCase().includes(selectedTypeFilter.toLowerCase());
        if (!matchesType) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesFacility = item.facilityName.toLowerCase().includes(query);
        const matchesDocType = item.documentType.toLowerCase().includes(query);
        const matchesCode = item.code.toLowerCase().includes(query);
        const matchesDoctor = item.doctorName?.toLowerCase().includes(query) || false;
        if (!matchesFacility && !matchesDocType && !matchesCode && !matchesDoctor) {
          return false;
        }
      }

      return true;
    });
  }, [records, activeTab, selectedTypeFilter, searchQuery]);

  // Search placeholder based on reference UX
  const searchPlaceholder = useMemo(() => {
    if (activeTab === 'timeline') {
      return t('records.searchTimelinePlaceholder');
    }
    if (activeTab === 'uploaded') {
      return t('records.searchUploadedPlaceholder');
    }
    return t('records.searchLinkedPlaceholder');
  }, [activeTab, t]);

  // Handlers
  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenDetail = (record: UnifiedRecord) => {
    setSelectedRecord(record);
    setDetailTab('smart');
    setDetailModalVisible(true);
  };

  const handleOpenOptions = (record: UnifiedRecord) => {
    setSelectedRecord(record);
    setOptionsModalVisible(true);
  };

  const handleDeleteRecord = (record: UnifiedRecord) => {
    // Dismiss options popup first
    setOptionsModalVisible(false);

    const isEpisode =
      record.code?.startsWith('EP-') ||
      (record.category === 'linked' && !record.storageInfo);

    const typeLabel = isEpisode
      ? (record.documentType || 'Clinical Episode Record')
      : (record.documentType || 'Health Document');

    Alert.alert(
      t('records.deleteTitle'),
      `${t('records.deleteWarning')}\n\n• ${isEpisode ? 'Record' : 'Document'}: ${typeLabel}\n• Code: ${record.code}`,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('records.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              if (isEpisode) {
                try {
                  await episodeApi.deleteEpisode(record.id);
                } catch (epErr) {
                  // Fallback: documentApi deleteDocument also resolves episodeId/code
                  await documentApi.deleteDocument(record.id);
                }
              } else {
                await documentApi.deleteDocument(record.id);
              }

              if (selectedRecord?.id === record.id) {
                setDetailModalVisible(false);
                setSelectedRecord(null);
              }

              // Refresh list and timeline from server
              await fetchRecords(true);

              Alert.alert(
                t('records.deleteTitle'),
                t('records.deleteSuccess')
              );
            } catch (err: any) {
              Alert.alert(
                t('common.error'),
                err.message || t('records.deleteFailed')
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUploadSuccess = async (uploadedDoc: any) => {
    setUploadModalVisible(false);
    setActiveTab('uploaded');
    const refreshedList = await fetchRecords(true);
    if (uploadedDoc) {
      const docId = uploadedDoc._id || uploadedDoc.id;
      const matching = (refreshedList || []).find((r: UnifiedRecord) => r.id === docId);
      if (matching) {
        setSelectedRecord(matching);
      } else {
        setSelectedRecord({
          id: docId || Math.random().toString(),
          code: uploadedDoc.documentCode || 'DOC-NEW',
          facilityName: uploadedDoc.source?.hospital || 'Self Uploaded Document',
          doctorName: uploadedDoc.source?.doctor,
          documentType: formatDocumentType(uploadedDoc.documentType),
          rawType: uploadedDoc.documentType,
          category: 'uploaded',
          statusBadge: 'Self Uploaded',
          date: formatRecordDate(uploadedDoc.source?.documentDate || uploadedDoc.createdAt),
          rawDate: uploadedDoc.source?.documentDate || uploadedDoc.createdAt,
          verificationStatus: uploadedDoc.verification?.status || 'unverified',
          extractionStatus: uploadedDoc.extractionStatus || 'completed',
          diagnoses: uploadedDoc.extractedData?.diagnoses,
          medications: uploadedDoc.extractedData?.medications,
          investigations: uploadedDoc.extractedData?.investigations,
          procedures: uploadedDoc.extractedData?.procedures,
          immunizations: uploadedDoc.extractedData?.immunizations,
          tests: uploadedDoc.extractedData?.tests,
          abnormalValues: uploadedDoc.extractedData?.abnormalValues,
          vitals: uploadedDoc.extractedData?.vitals,
          advice: uploadedDoc.extractedData?.advice,
          safetyAlerts: uploadedDoc.safetyAlerts,
          brainAnalysis: uploadedDoc.brainAnalysis,
          storageInfo: uploadedDoc.storage,
          extractedData: uploadedDoc.extractedData,
        });
      }
      setDetailTab('smart');
      setDetailModalVisible(true);
    }
  };


  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* 1. Curved Header Banner */}
      <View style={[styles.headerBanner, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerContentRow}>
          <Text style={styles.headerTitle}>{t('records.myRecordsTitle')}</Text>

          {/* Right Action: Link Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setLinkInfoModalVisible(true)}
            style={styles.linkButton}
            accessibilityRole="button"
            accessibilityLabel={t('records.linkRecordsTitle')}
          >
            <Ionicons name="link-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Top Record Category Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.segmentItem,
              activeTab === 'timeline' && styles.segmentItemActive,
            ]}
            onPress={() => setActiveTab('timeline')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'timeline' }}
            accessibilityLabel="Timeline tab"
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'timeline' && styles.segmentTextActive,
              ]}
            >
              {t('records.timelineTab')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.segmentItem,
              activeTab === 'uploaded' && styles.segmentItemActive,
            ]}
            onPress={() => setActiveTab('uploaded')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'uploaded' }}
            accessibilityLabel="Self Uploaded tab"
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'uploaded' && styles.segmentTextActive,
              ]}
            >
              {t('records.selfUploadedTab')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.segmentItem,
              activeTab === 'linked' && styles.segmentItemActive,
            ]}
            onPress={() => setActiveTab('linked')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'linked' }}
            accessibilityLabel="Linked Records tab"
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'linked' && styles.segmentTextActive,
              ]}
            >
              {t('records.linkedRecordsTab')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Search & Filter Controls */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Button: Shown on uploaded and linked tabs */}
        {activeTab === 'uploaded' || activeTab === 'linked' ? (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setFilterModalVisible(true)}
            style={[
              styles.filterButton,
              selectedTypeFilter !== 'all' && styles.filterButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Filter records"
          >
            <Ionicons
              name="funnel-outline"
              size={19}
              color={selectedTypeFilter !== 'all' ? '#FFFFFF' : colors.primary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4. Main Scrollable Content Area */}
      {activeTab === 'timeline' ? (
        <PatientHealthTimeline
          episodes={timelineEpisodes}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={() => fetchRecords(true)}
          searchQuery={searchQuery}
          onOpenRecordDocument={(episodeId) => {
            const matchingRecord = records.find(
              (r) => r.id === episodeId || r.code?.includes(episodeId)
            );
            if (matchingRecord) {
              handleOpenDetail(matchingRecord);
            } else if (records.length > 0) {
              handleOpenDetail(records[0]);
            }
          }}
        />
      ) : loading && !refreshing ? (
        <LoadingState message="Loading health records..." style={styles.centerFlex} />
      ) : error ? (
        <View style={styles.errorWrapper}>
          <ErrorState
            title="Unable to load records"
            message={error}
            onRetry={() => fetchRecords(true)}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRecords(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {filteredRecords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <DocumentEmptyIcon />
              <Text style={styles.emptyMessage}>{t('records.noRecordFound')}</Text>
              <Text style={styles.emptySubMessage}>
                {searchQuery
                  ? t('records.noRecordTimelineSub')
                  : activeTab === 'uploaded'
                  ? t('records.noRecordUploadedSub')
                  : t('records.noRecordLinkedSub')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => fetchRecords(true)}
                disabled={refreshing}
                style={styles.emptyRefreshButton}
                accessibilityRole="button"
                accessibilityLabel={t('records.refreshRecordsBtn')}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.emptyRefreshButtonText}>{t('records.refreshRecordsBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            filteredRecords.map((item) => (
              <RecordCard
                key={item.id}
                record={item}
                isBookmarked={Boolean(bookmarkedIds[item.id])}
                onToggleBookmark={handleToggleBookmark}
                onViewDetails={handleOpenDetail}
                onOptionsPress={handleOpenOptions}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* 5. Floating Upload Button (Above Bottom Navigation) */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setUploadModalVisible(true)}
        style={styles.floatingUploadBtn}
        accessibilityRole="button"
        accessibilityLabel="Upload Health Record"
      >
        <Ionicons name="arrow-up-outline" size={20} color="#FFFFFF" />
        <Text style={styles.floatingUploadText}>Upload</Text>
      </TouchableOpacity>

      {/* ========================================== */}
      {/* 6. Modals                                  */}
      {/* ========================================== */}

      {/* A. Record Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Record Details</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedRecord) {
                      handleDeleteRecord(selectedRecord);
                    }
                  }}
                  style={[styles.modalCloseBtn, { backgroundColor: '#FEF2F2' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete Record"
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dual View Segmented Switcher (Only shown if physical original document file exists) */}
            {selectedRecord && (selectedRecord.storageInfo || selectedRecord.category === 'uploaded') && (
              <View style={styles.detailTabBar}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.detailTabBtn,
                    detailTab === 'smart' && styles.detailTabBtnActive,
                  ]}
                  onPress={() => setDetailTab('smart')}
                >
                  <Ionicons
                    name="sparkles"
                    size={15}
                    color={detailTab === 'smart' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.detailTabBtnText,
                      detailTab === 'smart' && styles.detailTabBtnTextActive,
                    ]}
                  >
                    Smart Report
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.detailTabBtn,
                    detailTab === 'original' && styles.detailTabBtnActive,
                  ]}
                  onPress={() => setDetailTab('original')}
                >
                  <Ionicons
                    name="document-text"
                    size={15}
                    color={detailTab === 'original' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.detailTabBtnText,
                      detailTab === 'original' && styles.detailTabBtnTextActive,
                    ]}
                  >
                    Original Document
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedRecord && detailTab === 'smart' ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
                <SmartReportView
                  data={{
                    patientName: selectedRecord.extractedData?.patientName,
                    reportedDate: selectedRecord.extractedData?.reportedDate || selectedRecord.date,
                    clinicName: selectedRecord.facilityName,
                    healthDocumentType: selectedRecord.documentType,
                    diagnoses: selectedRecord.diagnoses,
                    immunizations: selectedRecord.immunizations,
                    procedures: selectedRecord.procedures,
                    medications: selectedRecord.medications,
                    investigations: selectedRecord.investigations,
                    tests: selectedRecord.tests,
                    vitals: selectedRecord.vitals,
                    advice: selectedRecord.advice,
                    safetyAlerts: selectedRecord.safetyAlerts,
                  }}
                  documentCode={selectedRecord.code}
                  onViewOriginal={() => setDetailTab('original')}
                />

                {/* Vaidyaarc Brain Model Clinical Intelligence Card */}
                {selectedRecord.brainAnalysis?.clinicalSummary ? (
                  <View style={styles.modalBrainBox}>
                    <View style={styles.modalBrainHeader}>
                      <View style={styles.modalBrainTitleRow}>
                        <Ionicons name="sparkles" size={18} color={colors.primary} />
                        <Text style={styles.modalBrainTitle}>Clinical Brain Intelligence</Text>
                      </View>
                      {selectedRecord.brainAnalysis.riskLevel ? (
                        <Badge
                          label={`${selectedRecord.brainAnalysis.riskLevel.toUpperCase()} RISK`}
                          variant={
                            selectedRecord.brainAnalysis.riskLevel === 'urgent' ||
                            selectedRecord.brainAnalysis.riskLevel === 'high'
                              ? 'error'
                              : selectedRecord.brainAnalysis.riskLevel === 'moderate'
                              ? 'warning'
                              : 'success'
                          }
                          size="sm"
                        />
                      ) : null}
                    </View>

                    <Text style={styles.modalBrainSummary}>
                      {selectedRecord.brainAnalysis.clinicalSummary}
                    </Text>

                    {/* Red Flags if any */}
                    {selectedRecord.brainAnalysis.redFlags &&
                    selectedRecord.brainAnalysis.redFlags.length > 0 ? (
                      <View style={{ marginTop: 6 }}>
                        <Text style={[styles.modalBrainSubtitle, { color: colors.error }]}>
                          Key Red Flags:
                        </Text>
                        {selectedRecord.brainAnalysis.redFlags.map((flag, idx) => (
                          <View key={idx} style={styles.modalBrainBullet}>
                            <Ionicons name="alert-circle" size={14} color={colors.error} style={{ marginTop: 2 }} />
                            <Text style={styles.modalBrainBulletText}>{flag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Suggested Next Steps */}
                    {selectedRecord.brainAnalysis.suggestedNextSteps &&
                    selectedRecord.brainAnalysis.suggestedNextSteps.length > 0 ? (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.modalBrainSubtitle}>Suggested Next Steps:</Text>
                        {selectedRecord.brainAnalysis.suggestedNextSteps.map((step, idx) => (
                          <View key={idx} style={styles.modalBrainBullet}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginTop: 2 }} />
                            <Text style={styles.modalBrainBulletText}>{step}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Care Plan Highlights */}
                    {selectedRecord.brainAnalysis.carePlanHighlights &&
                    selectedRecord.brainAnalysis.carePlanHighlights.length > 0 ? (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.modalBrainSubtitle}>Care Plan Highlights:</Text>
                        {selectedRecord.brainAnalysis.carePlanHighlights.map((hl, idx) => (
                          <View key={idx} style={styles.modalBrainBullet}>
                            <Ionicons name="shield-checkmark" size={14} color={colors.success} style={{ marginTop: 2 }} />
                            <Text style={styles.modalBrainBulletText}>{hl}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Clinical Notes if Episode */}
                {selectedRecord.clinicalNotes ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Clinical Notes</Text>
                    <Text style={styles.modalSectionBody}>
                      {selectedRecord.clinicalNotes}
                    </Text>
                  </View>
                ) : null}

                {/* Close Button */}
                <Button
                  title="Done"
                  variant="primary"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.modalDoneBtn}
                />
              </ScrollView>
            ) : selectedRecord && detailTab === 'original' ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
                <OriginalReportView
                  documentId={selectedRecord.id}
                  documentCode={selectedRecord.code}
                  documentType={selectedRecord.documentType}
                  hospital={selectedRecord.facilityName}
                  date={selectedRecord.date}
                  mimeType={selectedRecord.storageInfo?.contentType || 'image/jpeg'}
                  fileName={selectedRecord.storageInfo?.fileName}
                />
                <Button
                  title="Done"
                  variant="primary"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.modalDoneBtn}
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* B. Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Filter Records</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setFilterModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Health Document Type</Text>
            <View style={styles.filterOptionsGrid}>
              {[
                { label: 'All Types', value: 'all' },
                { label: 'Prescription', value: 'prescription' },
                { label: 'Laboratory Report', value: 'laboratory_report' },
                { label: 'Discharge Summary', value: 'discharge_summary' },
                { label: 'Diagnostic Imaging', value: 'imaging' },
                { label: 'Consultation Note', value: 'consultation_note' },
              ].map((opt) => {
                const isSelected = selectedTypeFilter === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.8}
                    onPress={() => setSelectedTypeFilter(opt.value)}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterActionRow}>
              <Button
                title="Reset"
                variant="secondary"
                size="md"
                onPress={() => {
                  setSelectedTypeFilter('all');
                  setFilterModalVisible(false);
                }}
                style={styles.filterResetBtn}
              />
              <Button
                title="Apply Filter"
                variant="primary"
                size="md"
                onPress={() => setFilterModalVisible(false)}
                style={styles.filterApplyBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* C. Modern Medical Document Upload Workflow Modal */}
      <DocumentUploadWorkflowModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* D. Link Records Info Modal */}
      <Modal
        visible={linkInfoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLinkInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Linked ABDM Records</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setLinkInfoModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.linkInfoBox}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
              <View style={styles.linkInfoCol}>
                <Text style={styles.linkInfoTitle}>ABDM Gateway Connected</Text>
                <Text style={styles.linkInfoAbha}>
                  ABHA ID: {user?.abhaId || '91-4829-1029-3819'}
                </Text>
              </View>
            </View>

            <Text style={styles.linkInfoDescription}>
              Clinical records issued by empanelled hospitals, clinics, and diagnostic centers are automatically linked to your SWASTHYA-SETU repository using ABDM health data networks.
            </Text>

            <Button
              title="Got it"
              variant="primary"
              onPress={() => setLinkInfoModalVisible(false)}
              style={styles.modalDoneBtn}
            />
          </View>
        </View>
      </Modal>

      {/* E. Card Overflow Options Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
          style={styles.optionsModalOverlay}
        >
          <View style={styles.optionsModalSheet}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setOptionsModalVisible(false);
                if (selectedRecord) handleOpenDetail(selectedRecord);
              }}
              style={styles.optionsRow}
            >
              <Ionicons name="eye-outline" size={20} color={colors.primary} />
              <Text style={styles.optionsText}>View Full Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (selectedRecord) handleToggleBookmark(selectedRecord.id);
                setOptionsModalVisible(false);
              }}
              style={styles.optionsRow}
            >
              <Ionicons
                name={
                  selectedRecord && bookmarkedIds[selectedRecord.id]
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={20}
                color={colors.primary}
              />
              <Text style={styles.optionsText}>
                {selectedRecord && bookmarkedIds[selectedRecord.id]
                  ? 'Remove Bookmark'
                  : 'Bookmark Record'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOptionsModalVisible(false)}
              style={styles.optionsRow}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              <Text style={styles.optionsText}>Share with Doctor</Text>
            </TouchableOpacity>

            <View style={styles.optionsDivider} />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (selectedRecord) {
                  handleDeleteRecord(selectedRecord);
                }
              }}
              style={[styles.optionsRow, styles.optionsDeleteRow]}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={[styles.optionsText, styles.optionsDeleteText]}>Delete Record</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorWrapper: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },

  // 1. Header Banner
  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...shadows.card,
  },
  headerContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnPrimary,
    letterSpacing: -0.3,
  },
  linkButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Category Tabs
  tabsWrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.bold,
  },

  // 3. Search & Filter Controls
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: spacing.sm + 4,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: spacing.xs + 2,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: spacing.xxs,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // 4. Content Area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 120, // ample space above bottom navigation and upload button
    flexGrow: 1,
  },

  // 5. Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyDocIconContainer: {
    width: 100,
    height: 95,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyDocBack: {
    position: 'absolute',
    top: 6,
    right: 16,
    width: 54,
    height: 68,
    borderWidth: 3.5,
    borderColor: '#94A3B8',
    borderRadius: 7,
    backgroundColor: colors.background,
  },
  emptyDocFront: {
    position: 'absolute',
    top: 14,
    left: 16,
    width: 54,
    height: 68,
    borderWidth: 3.5,
    borderColor: '#94A3B8',
    borderRadius: 7,
    backgroundColor: colors.background,
    paddingTop: 12,
    paddingLeft: 8,
    gap: 6,
  },
  emptyDocLine: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
  },
  emptyMagnifierWrapper: {
    position: 'absolute',
    bottom: 2,
    right: 8,
    alignItems: 'center',
  },
  emptyMagnifierCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3.5,
    borderColor: '#94A3B8',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMagnifierHandle: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
    marginLeft: 18,
  },
  emptyMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  emptyRefreshButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  emptyRefreshButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // 6. Record Card
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardFacilityCol: {
    flex: 1,
  },
  cardMetaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 2,
  },
  cardFacilityName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  cardHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardStatusBadge: {
    alignSelf: 'center',
  },
  cardOverflowBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xxs,
  },
  cardFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
  },
  cardFieldCol: {
    flex: 1,
  },
  cardPatientRef: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  bookmarkBtn: {
    padding: spacing.xs,
  },
  cardDocumentType: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardDateText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  viewRecordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 4,
  },
  viewRecordsBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.fontWeight.semiBold,
  },

  // 7. Floating Upload Button
  floatingUploadBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: 85, // Comfortably above bottom nav
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 26,
    gap: spacing.xs + 2,
    ...shadows.elevated,
  },
  floatingUploadText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.1,
  },

  // 8. Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '85%',
    ...shadows.elevated,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalHeaderTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  detailTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  detailTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    gap: 6,
  },
  detailTabBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  detailTabBtnText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  detailTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  modalBodyScroll: {
    marginBottom: spacing.md,
  },
  modalFacilityBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalFacilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalMetaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalFacilityTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalDoctorSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalGrid: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  modalGridCol: {
    flex: 1,
  },
  modalGridValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  modalGridCode: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSectionBody: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalTag: {
    backgroundColor: colors.mintWash,
    borderRadius: borderRadius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  modalTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  // Modal Safety Alerts Banner
  modalAlertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  modalAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modalAlertTitle: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold,
    color: '#B91C1C',
  },
  modalAlertText: {
    fontSize: typography.fontSize.xs,
    color: '#7F1D1D',
    lineHeight: 16,
  },

  // Modal Brain Intelligence Box
  modalBrainBox: {
    backgroundColor: '#F0FAF8',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalBrainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  modalBrainTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalBrainTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  modalBrainSummary: {
    fontSize: typography.fontSize.xs + 1,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  modalBrainSubtitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs + 2,
    marginBottom: 4,
  },
  modalBrainBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  modalBrainBulletText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // Extracted Vitals Grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  vitalCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '45%',
    flex: 1,
  },
  vitalParamText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  vitalValueText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },

  // Extracted Tests List
  testsList: {
    gap: spacing.xs,
  },
  testCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testNameText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  // Extracted Advice
  adviceList: {
    gap: 4,
  },
  adviceBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  adviceText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },

  modalDoneBtn: {
    marginTop: spacing.md,
  },

  // Filter Modal Styles
  filterSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  filterActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filterResetBtn: {
    flex: 1,
  },
  filterApplyBtn: {
    flex: 1,
  },

  // Upload Modal Styles
  uploadModalDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  uploadOptionsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  uploadOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  uploadOptionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mintWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  uploadOptionTextCol: {
    flex: 1,
  },
  uploadOptionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  uploadOptionSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Link Info Modal Styles
  linkInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintWash,
    padding: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  linkInfoCol: {
    flex: 1,
  },
  linkInfoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  linkInfoAbha: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    marginTop: 2,
    fontWeight: typography.fontWeight.medium,
  },
  linkInfoDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },

  // Overflow Options Modal
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  optionsModalSheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.elevated,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    gap: spacing.sm + 2,
  },
  optionsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  optionsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: spacing.xs,
  },
  optionsDeleteRow: {
    backgroundColor: '#FEF2F2',
  },
  optionsDeleteText: {
    color: '#DC2626',
    fontWeight: typography.fontWeight.semiBold,
  },

  // Uploading / Processing Overlay Modal
  uploadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  uploadingCard: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.elevated,
  },
  uploadingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  uploadingSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});


