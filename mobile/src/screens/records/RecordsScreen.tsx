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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { Badge, Button, LoadingState, ErrorState } from '../../components';
import { apiClient } from '../../api/apiClient';
import { episodeApi } from '../../api/episodeApi';
import { useAuthStore } from '../../store/authStore';

// ==========================================
// Types
// ==========================================

export type RecordCategoryTab = 'all' | 'uploaded' | 'linked';

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
  abnormalValues?: string[];
  clinicalNotes?: string;
  storageInfo?: {
    size?: number;
    contentType?: string;
    bucket?: string;
  };
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
  const iconName = getDocumentIconName(record.documentType);

  return (
    <View style={styles.cardContainer}>
      {/* Top Row: Icon + Facility Name + Badge + 3-Dots */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconWrapper}>
          <Ionicons name={iconName} size={22} color={colors.primary} />
        </View>

        <View style={styles.cardFacilityCol}>
          <Text style={styles.cardMetaLabel}>Facility Name</Text>
          <Text style={styles.cardFacilityName} numberOfLines={1}>
            {record.facilityName}
          </Text>
        </View>

        <View style={styles.cardHeaderRightActions}>
          <Badge
            label={record.statusBadge}
            variant="mint"
            size="sm"
            style={styles.cardStatusBadge}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOptionsPress(record)}
            style={styles.cardOverflowBtn}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Middle Row: Patient ref number + Bookmark */}
      <View style={styles.cardFieldRow}>
        <View style={styles.cardFieldCol}>
          <Text style={styles.cardMetaLabel}>Patient ref number</Text>
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
          <Text style={styles.cardMetaLabel}>Health Document Type</Text>
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
          <Text style={styles.viewRecordsBtnText}>View Records</Text>
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

  // State
  const [activeTab, setActiveTab] = useState<RecordCategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & UI Controls
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
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
          const isLinked = Boolean(
            doc.source?.hospital ||
              doc.verification?.status === 'verified' ||
              doc.storage?.provider === 'abdm'
          );

          unified.push({
            id: doc._id || doc.documentCode || Math.random().toString(),
            code: doc.documentCode || doc.patientRefNumber || 'REF-UNLINKED',
            facilityName:
              doc.source?.hospital ||
              doc.source?.facility ||
              (isLinked ? 'Linked Healthcare Facility' : 'Self Uploaded Document'),
            doctorName: doc.source?.doctor,
            documentType: formatDocumentType(doc.documentType),
            rawType: doc.documentType,
            category: isLinked ? 'linked' : 'uploaded',
            statusBadge: isLinked ? 'Linked Record' : 'Self Uploaded',
            date: formatRecordDate(doc.source?.documentDate || doc.createdAt),
            rawDate: doc.source?.documentDate || doc.createdAt,
            verificationStatus: doc.verification?.status || 'unverified',
            extractionStatus: doc.extractionStatus || 'pending',
            diagnoses: doc.extractedData?.diagnoses,
            medications: doc.extractedData?.medications,
            investigations: doc.extractedData?.investigations,
            procedures: doc.extractedData?.procedures,
            abnormalValues: doc.extractedData?.abnormalValues,
            storageInfo: doc.storage,
          });
        });
      } catch (docErr) {
        console.warn('Documents fetch note:', docErr);
      }

      // 2. Fetch real episodes from /episodes endpoint
      try {
        const epRes: any = await episodeApi.getEpisodes();
        const epList = Array.isArray(epRes?.data)
          ? epRes.data
          : Array.isArray(epRes)
          ? epRes
          : [];

        epList.forEach((ep: any) => {
          const doctorName =
            typeof ep.doctorId === 'object' && ep.doctorId?.name
              ? ep.doctorId.name
              : undefined;

          unified.push({
            id: ep._id || ep.episodeCode || Math.random().toString(),
            code: ep.episodeCode || 'EP-RECORD',
            facilityName: doctorName
              ? `Dr. ${doctorName} Consultation`
              : 'Clinical Episode Record',
            doctorName,
            documentType: formatDocumentType(ep.type || 'consultation'),
            rawType: ep.type,
            category: 'linked',
            statusBadge: 'Linked Record',
            date: formatRecordDate(ep.startedAt || ep.createdAt),
            rawDate: ep.startedAt || ep.createdAt,
            verificationStatus: 'verified',
            extractionStatus: 'completed',
            clinicalNotes: ep.clinicalNotes,
          });
        });
      } catch (epErr) {
        console.warn('Episodes fetch note:', epErr);
      }

      setRecords(unified);
    } catch (err: any) {
      console.warn('Failed to fetch records:', err?.message || err);
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
    if (activeTab === 'uploaded') {
      return 'Search by Facility, Test or Health Document';
    }
    return 'Search Hospital, Clinic or Lab';
  }, [activeTab]);

  // Handlers
  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenDetail = (record: UnifiedRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const handleOpenOptions = (record: UnifiedRecord) => {
    setSelectedRecord(record);
    setOptionsModalVisible(true);
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* 1. Curved Header Banner */}
      <View style={[styles.headerBanner, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerContentRow}>
          <Text style={styles.headerTitle}>My Records</Text>

          {/* Right Action: Link Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setLinkInfoModalVisible(true)}
            style={styles.linkButton}
            accessibilityRole="button"
            accessibilityLabel="Link Health Records"
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
              activeTab === 'all' && styles.segmentItemActive,
            ]}
            onPress={() => setActiveTab('all')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'all' }}
            accessibilityLabel="All Records tab"
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'all' && styles.segmentTextActive,
              ]}
            >
              All Records
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
              Self Uploaded
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
              Linked Records
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

        {/* Filter Button: Highlighted or shown on All Records */}
        {activeTab === 'all' ? (
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
      {loading && !refreshing ? (
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
              <Text style={styles.emptyMessage}>No record found</Text>
              <Text style={styles.emptySubMessage}>
                {searchQuery
                  ? 'No records match your search criteria. Try a different query or clear filters.'
                  : activeTab === 'uploaded'
                  ? 'You have not uploaded any records yet. Tap Upload below to add your prescriptions or lab tests.'
                  : activeTab === 'linked'
                  ? 'No clinical records have been linked from hospitals or diagnostic labs yet.'
                  : 'No health records found in this category. You can upload or link new medical documents.'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => fetchRecords(true)}
                disabled={refreshing}
                style={styles.emptyRefreshButton}
                accessibilityRole="button"
                accessibilityLabel="Refresh Records"
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.emptyRefreshButtonText}>Refresh Records</Text>
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
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDetailModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
                {/* Facility & Type Badge */}
                <View style={styles.modalFacilityBox}>
                  <View style={styles.modalFacilityHeader}>
                    <Text style={styles.modalMetaLabel}>HEALTHCARE FACILITY</Text>
                    <Badge
                      label={selectedRecord.statusBadge}
                      variant="mint"
                      size="sm"
                    />
                  </View>
                  <Text style={styles.modalFacilityTitle}>
                    {selectedRecord.facilityName}
                  </Text>
                  {selectedRecord.doctorName ? (
                    <Text style={styles.modalDoctorSubtitle}>
                      Prescribing / Consulting Doctor: Dr. {selectedRecord.doctorName}
                    </Text>
                  ) : null}
                </View>

                {/* Metadata Grid */}
                <View style={styles.modalGrid}>
                  <View style={styles.modalGridCol}>
                    <Text style={styles.modalMetaLabel}>DOCUMENT TYPE</Text>
                    <Text style={styles.modalGridValue}>
                      {selectedRecord.documentType}
                    </Text>
                  </View>
                  <View style={styles.modalGridCol}>
                    <Text style={styles.modalMetaLabel}>DATE</Text>
                    <Text style={styles.modalGridValue}>{selectedRecord.date}</Text>
                  </View>
                </View>

                <View style={styles.modalGrid}>
                  <View style={styles.modalGridCol}>
                    <Text style={styles.modalMetaLabel}>REFERENCE CODE</Text>
                    <Text style={styles.modalGridCode}>{selectedRecord.code}</Text>
                  </View>
                  <View style={styles.modalGridCol}>
                    <Text style={styles.modalMetaLabel}>VERIFICATION</Text>
                    <Text
                      style={[
                        styles.modalGridValue,
                        {
                          color:
                            selectedRecord.verificationStatus === 'verified'
                              ? colors.success
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {selectedRecord.verificationStatus
                        ? selectedRecord.verificationStatus.toUpperCase()
                        : 'UNVERIFIED'}
                    </Text>
                  </View>
                </View>

                {/* Clinical Notes if Episode */}
                {selectedRecord.clinicalNotes ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Clinical Notes</Text>
                    <Text style={styles.modalSectionBody}>
                      {selectedRecord.clinicalNotes}
                    </Text>
                  </View>
                ) : null}

                {/* Extracted Diagnoses */}
                {selectedRecord.diagnoses && selectedRecord.diagnoses.length > 0 ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Diagnoses</Text>
                    <View style={styles.tagList}>
                      {selectedRecord.diagnoses.map((diag, index) => (
                        <View key={index} style={styles.modalTag}>
                          <Text style={styles.modalTagText}>{diag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Extracted Medications */}
                {selectedRecord.medications && selectedRecord.medications.length > 0 ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Medications</Text>
                    <View style={styles.tagList}>
                      {selectedRecord.medications.map((med, index) => (
                        <View key={index} style={styles.modalTag}>
                          <Text style={styles.modalTagText}>{med}</Text>
                        </View>
                      ))}
                    </View>
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
            )}
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

      {/* C. Upload Modal */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Upload Health Record</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setUploadModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.uploadModalDescription}>
              Upload verified prescriptions, pathology laboratory tests, or hospital discharge summaries to your secure health vault.
            </Text>

            <View style={styles.uploadOptionsList}>
              {[
                {
                  title: 'Doctor Prescription',
                  subtitle: 'e-Rx slip, outpatient paper prescription',
                  icon: 'receipt-outline',
                },
                {
                  title: 'Laboratory / Pathology Report',
                  subtitle: 'Blood tests (CBC, LFT, KFT), urine test reports',
                  icon: 'flask-outline',
                },
                {
                  title: 'Hospital Discharge Summary',
                  subtitle: 'Inpatient discharge notes and treatment summary',
                  icon: 'clipboard-outline',
                },
                {
                  title: 'Diagnostic Imaging / Radiology',
                  subtitle: 'X-Ray, MRI, CT Scan, Ultrasound reports',
                  icon: 'scan-outline',
                },
              ].map((item, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.75}
                  onPress={() => {
                    setUploadModalVisible(false);
                  }}
                  style={styles.uploadOptionItem}
                >
                  <View style={styles.uploadOptionIconCircle}>
                    <Ionicons name={item.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.uploadOptionTextCol}>
                    <Text style={styles.uploadOptionTitle}>{item.title}</Text>
                    <Text style={styles.uploadOptionSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Close"
              variant="secondary"
              onPress={() => setUploadModalVisible(false)}
              style={styles.modalDoneBtn}
            />
          </View>
        </View>
      </Modal>

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
});

