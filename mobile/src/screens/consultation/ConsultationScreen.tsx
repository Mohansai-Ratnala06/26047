import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { consentApi } from '../../api/consentApi';
import { Button, LoadingState, ErrorState } from '../../components';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

// ==========================================
// Types
// ==========================================

export interface ConsentRecord {
  _id: string;
  consentCode?: string;
  patientId?: string;
  grantedTo?: {
    _id?: string;
    name?: string;
    phone?: string;
  } | string;
  purpose?: string;
  scope?: string;
  status: 'PENDING' | 'GRANTED' | 'REVOKED' | 'EXPIRED' | string;
  version?: number;
  expiresAt?: string;
  revokedAt?: string;
  revokedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

type PrimarySegment = 'Requests' | 'Approved';
type RequestsSubTab = 'All' | 'Pending' | 'Denied' | 'Expired';
type ApprovedSubTab = 'Granted' | 'Expired' | 'Revoked';

// ==========================================
// Helper Functions
// ==========================================

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Permanent / Not specified';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getOrganizationName(record: ConsentRecord): string {
  if (typeof record.grantedTo === 'object' && record.grantedTo?.name) {
    return record.grantedTo.name;
  }
  if (typeof record.grantedTo === 'string' && record.grantedTo.trim()) {
    return record.grantedTo;
  }
  return 'Health Repository Service';
}

function isDateExpired(dateString?: string): boolean {
  if (!dateString) return false;
  const exp = new Date(dateString).getTime();
  return !isNaN(exp) && exp < Date.now();
}

// ==========================================
// Reusable Status Badge
// ==========================================

interface ConsentBadgeProps {
  status: string;
}

const ConsentBadge: React.FC<ConsentBadgeProps> = ({ status }) => {
  const normalized = (status || '').toUpperCase();

  let label = 'Requested';
  let iconName: keyof typeof Ionicons.glyphMap = 'time-outline';
  let bg = colors.warningLight;
  let text = colors.warningText;
  let border = colors.warning;

  if (normalized === 'GRANTED') {
    label = 'Granted';
    iconName = 'checkmark-circle';
    bg = colors.successLight;
    text = colors.successText;
    border = colors.success;
  } else if (normalized === 'DENIED') {
    label = 'Denied';
    iconName = 'close-circle';
    bg = colors.errorLight;
    text = colors.dangerText;
    border = colors.error;
  } else if (normalized === 'REVOKED') {
    label = 'Revoked';
    iconName = 'ban-outline';
    bg = colors.errorLight;
    text = colors.dangerText;
    border = colors.error;
  } else if (normalized === 'EXPIRED') {
    label = 'Expired';
    iconName = 'hourglass-outline';
    bg = colors.surfaceSubtle;
    text = colors.textSecondary;
    border = colors.border;
  } else {
    label = normalized === 'PENDING' ? 'Pending' : 'Requested';
    iconName = 'time-outline';
    bg = '#FEF3C7';
    text = '#B45309';
    border = '#F59E0B';
  }

  return (
    <View style={[styles.badgeContainer, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={iconName} size={12} color={text} style={styles.badgeIcon} />
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
};

// ==========================================
// Reusable Request Card
// ==========================================

interface RequestCardProps {
  record: ConsentRecord;
  onViewMore: (record: ConsentRecord) => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ record, onViewMore }) => {
  const orgName = getOrganizationName(record);
  const timeText = formatRelativeTime(record.createdAt);
  const displayStatus = isDateExpired(record.expiresAt) ? 'EXPIRED' : record.status;

  return (
    <View style={styles.consentCard}>
      {/* Top Tag */}
      <Text style={styles.cardHeaderTag}>Subscription Request</Text>

      {/* Main Title & Status Row */}
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {orgName}
        </Text>
        <View style={styles.cardStatusCol}>
          <ConsentBadge status={displayStatus} />
          {timeText ? <Text style={styles.cardTimestamp}>{timeText}</Text> : null}
        </View>
      </View>

      {/* Purpose Section */}
      <View style={styles.cardSection}>
        <Text style={styles.cardSectionLabel}>Purpose of request</Text>
        <Text style={styles.cardSectionValue} numberOfLines={2}>
          {record.purpose || 'Health Data Consultation & Review'}
        </Text>
      </View>

      {/* Action */}
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.viewMoreBtn}
        onPress={() => onViewMore(record)}
        accessibilityRole="button"
        accessibilityLabel={`View more details for consent from ${orgName}`}
      >
        <Text style={styles.viewMoreBtnText}>View More</Text>
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// Reusable Approved / Granted Card
// ==========================================

interface GrantedCardProps {
  record: ConsentRecord;
  onViewMore: (record: ConsentRecord) => void;
}

const GrantedCard: React.FC<GrantedCardProps> = ({ record, onViewMore }) => {
  const orgName = getOrganizationName(record);
  const grantedDate = formatDate(record.createdAt);
  const expiryDate = formatDate(record.expiresAt);
  const displayStatus = isDateExpired(record.expiresAt) ? 'EXPIRED' : record.status;

  return (
    <View style={styles.consentCard}>
      {/* Top Tag */}
      <Text style={styles.cardHeaderTag}>Data Access Granted</Text>

      {/* Main Title & Status Row */}
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {orgName}
        </Text>
        <ConsentBadge status={displayStatus} />
      </View>

      {/* Purpose Section */}
      <View style={styles.cardSection}>
        <Text style={styles.cardSectionLabel}>Purpose</Text>
        <Text style={styles.cardSectionValue} numberOfLines={2}>
          {record.purpose || 'Continuous Care & Medical Records Access'}
        </Text>
      </View>

      {/* Date Metas */}
      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Access granted</Text>
          <Text style={styles.metaValue}>{grantedDate}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Valid until</Text>
          <Text style={styles.metaValue}>{expiryDate}</Text>
        </View>
      </View>

      {/* Action */}
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.viewMoreBtn}
        onPress={() => onViewMore(record)}
        accessibilityRole="button"
        accessibilityLabel={`View more details for granted consent to ${orgName}`}
      >
        <Text style={styles.viewMoreBtnText}>View More</Text>
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// Empty State Component
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

interface ConsentEmptyStateProps {
  primarySegment: PrimarySegment;
  subTab: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const ConsentEmptyState: React.FC<ConsentEmptyStateProps> = ({
  primarySegment,
  subTab,
  onRefresh,
  isRefreshing,
}) => {
  let message = 'We did not find any requests at the moment';

  if (primarySegment === 'Requests') {
    if (subTab === 'Pending') {
      message = 'We did not find any pending requests at the moment';
    } else if (subTab === 'Denied') {
      message = 'We did not find any denied requests at the moment';
    } else if (subTab === 'Expired') {
      message = 'We did not find any expired requests at the moment';
    } else {
      message = 'We did not find any requests at the moment';
    }
  } else {
    if (subTab === 'Granted') {
      message = 'We did not find any granted requests at the moment';
    } else if (subTab === 'Expired') {
      message = 'We did not find any expired requests at the moment';
    } else if (subTab === 'Revoked') {
      message = 'We did not find any revoked requests at the moment';
    } else {
      message = 'We did not find any requests at the moment';
    }
  }

  return (
    <View style={styles.emptyContainer}>
      <DocumentEmptyIcon />
      <Text style={styles.emptyMessage}>{message}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onRefresh}
        disabled={isRefreshing}
        style={styles.emptyRetryButton}
        accessibilityRole="button"
        accessibilityLabel="Retry or refresh requests"
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.emptyRetryButtonText}>Retry</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// Details Modal ("View More")
// ==========================================

interface ConsentModalProps {
  visible: boolean;
  record: ConsentRecord | null;
  onClose: () => void;
  onActionComplete: () => void;
}

const ConsentDetailModal: React.FC<ConsentModalProps> = ({
  visible,
  record,
  onClose,
  onActionComplete,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!record) return null;

  const orgName = getOrganizationName(record);
  const displayStatus = isDateExpired(record.expiresAt) ? 'EXPIRED' : record.status;
  const isPending = displayStatus === 'PENDING' || displayStatus === 'REQUESTED';
  const isGranted = displayStatus === 'GRANTED';

  const handleUpdateStatus = async (newStatus: 'GRANTED' | 'REVOKED', reason?: string) => {
    try {
      setSubmitting(true);
      setActionError(null);
      await consentApi.updateConsent(record._id, {
        status: newStatus,
        ...(reason ? { revokedReason: reason } : {}),
      });
      onActionComplete();
      onClose();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update consent status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Top Pill Handle */}
          <View style={styles.modalHandle} />

          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderTitle}>Consent Details</Text>
              <Text style={styles.modalHeaderSubtitle}>
                {record.consentCode ? `Reference: ${record.consentCode}` : 'Health Record Sharing'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close details modal"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Status & Org Row */}
            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalFieldLabel}>Requesting Entity</Text>
              <Text style={styles.modalFieldValueBold}>{orgName}</Text>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalFieldLabel}>Current Status</Text>
              <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <ConsentBadge status={displayStatus} />
              </View>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalFieldLabel}>Purpose of Access</Text>
              <Text style={styles.modalFieldValue}>
                {record.purpose || 'Self-requested health profile access and clinical records sharing.'}
              </Text>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalFieldLabel}>Data Scope & Permissions</Text>
              <Text style={styles.modalFieldValue}>
                {record.scope || 'Longitudinal health records, diagnostic tests, prescriptions & consultation history.'}
              </Text>
            </View>

            <View style={styles.modalMetaRow}>
              <View style={styles.modalMetaCol}>
                <Text style={styles.modalFieldLabel}>Created / Requested</Text>
                <Text style={styles.modalFieldValueSmall}>{formatDate(record.createdAt)}</Text>
              </View>
              <View style={styles.modalMetaCol}>
                <Text style={styles.modalFieldLabel}>Valid Until</Text>
                <Text style={styles.modalFieldValueSmall}>{formatDate(record.expiresAt)}</Text>
              </View>
            </View>

            {record.revokedAt ? (
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Revoked At</Text>
                <Text style={styles.modalFieldValueSmall}>
                  {formatDate(record.revokedAt)}
                  {record.revokedReason ? ` — Reason: ${record.revokedReason}` : ''}
                </Text>
              </View>
            ) : null}

            {actionError ? (
              <Text style={styles.modalErrorText}>{actionError}</Text>
            ) : null}

            {/* Actions for patient control */}
            <View style={styles.modalActions}>
              {submitting ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : (
                <>
                  {isPending ? (
                    <View style={styles.actionButtonGroup}>
                      <Button
                        title="Grant Consent"
                        variant="primary"
                        onPress={() => handleUpdateStatus('GRANTED')}
                        style={styles.modalActionButton}
                      />
                      <Button
                        title="Deny Request"
                        variant="outline"
                        onPress={() => handleUpdateStatus('REVOKED', 'Denied by patient')}
                        style={styles.modalActionButton}
                      />
                    </View>
                  ) : null}

                  {isGranted ? (
                    <Button
                      title="Revoke Data Access"
                      variant="danger"
                      onPress={() => handleUpdateStatus('REVOKED', 'Revoked by patient')}
                      style={styles.modalActionButton}
                    />
                  ) : null}
                </>
              )}

              <Button
                title="Close"
                variant="secondary"
                size="sm"
                onPress={onClose}
                style={styles.modalCloseActionButton}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ==========================================
// Main Screen Component
// ==========================================

export const ConsultationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Navigation / Tabs State
  const [primarySegment, setPrimarySegment] = useState<PrimarySegment>('Requests');
  const [requestsSubTab, setRequestsSubTab] = useState<RequestsSubTab>('All');
  const [approvedSubTab, setApprovedSubTab] = useState<ApprovedSubTab>('Granted');

  // Backend Data State
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<ConsentRecord | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Fetch Consents using existing API
  const fetchConsents = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await consentApi.getConsents();
      if (res && res.success && Array.isArray(res.data)) {
        setConsents(res.data);
      } else if (Array.isArray(res)) {
        setConsents(res);
      } else if (res && Array.isArray(res.data?.data)) {
        setConsents(res.data.data);
      } else {
        setConsents([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load consents. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  // Filtering Logic
  const filteredRecords = useMemo(() => {
    if (primarySegment === 'Requests') {
      return consents.filter((item) => {
        const normalized = (item.status || '').toUpperCase();
        const expired = isDateExpired(item.expiresAt);

        if (requestsSubTab === 'All') {
          return true;
        }
        if (requestsSubTab === 'Pending') {
          return (normalized === 'PENDING' || normalized === 'REQUESTED') && !expired;
        }
        if (requestsSubTab === 'Denied') {
          return normalized === 'DENIED' || (normalized === 'REVOKED' && !expired);
        }
        if (requestsSubTab === 'Expired') {
          return normalized === 'EXPIRED' || expired;
        }
        return true;
      });
    } else {
      return consents.filter((item) => {
        const normalized = (item.status || '').toUpperCase();
        const expired = isDateExpired(item.expiresAt);

        if (approvedSubTab === 'Granted') {
          return normalized === 'GRANTED' && !expired;
        }
        if (approvedSubTab === 'Expired') {
          return normalized === 'EXPIRED' || (normalized === 'GRANTED' && expired);
        }
        if (approvedSubTab === 'Revoked') {
          return normalized === 'REVOKED';
        }
        return false;
      });
    }
  }, [consents, primarySegment, requestsSubTab, approvedSubTab]);

  const handleOpenDetail = (record: ConsentRecord) => {
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const handleCloseDetail = () => {
    setModalVisible(false);
    setSelectedRecord(null);
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* 1. Header with Primary Color & Rounded Bottom Corners */}
      <View
        style={[
          styles.headerContainer,
          { paddingTop: Math.max(insets.top, 16) + spacing.xs },
        ]}
      >
        <Text style={styles.headerTitle}>My Consents</Text>
      </View>

      {/* 2. Primary Segmented Control (Requests | Approved) */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.segmentItem,
            primarySegment === 'Requests' && styles.segmentItemActive,
          ]}
          onPress={() => setPrimarySegment('Requests')}
          accessibilityRole="tab"
          accessibilityState={{ selected: primarySegment === 'Requests' }}
          accessibilityLabel="Requests tab"
        >
          <Text
            style={[
              styles.segmentText,
              primarySegment === 'Requests' && styles.segmentTextActive,
            ]}
          >
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.segmentItem,
            primarySegment === 'Approved' && styles.segmentItemActive,
          ]}
          onPress={() => setPrimarySegment('Approved')}
          accessibilityRole="tab"
          accessibilityState={{ selected: primarySegment === 'Approved' }}
          accessibilityLabel="Approved tab"
        >
          <Text
            style={[
              styles.segmentText,
              primarySegment === 'Approved' && styles.segmentTextActive,
            ]}
          >
            Approved
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Secondary Sub-Tabs Row */}
      {primarySegment === 'Requests' ? (
        <View style={styles.subTabRow}>
          {(['All', 'Pending', 'Denied', 'Expired'] as RequestsSubTab[]).map((tab) => {
            const isActive = requestsSubTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.75}
                style={styles.subTabItem}
                onPress={() => setRequestsSubTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab} requests`}
              >
                <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                  {tab}
                </Text>
                {isActive ? <View style={styles.subTabIndicator} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.subTabRow}>
          {(['Granted', 'Expired', 'Revoked'] as ApprovedSubTab[]).map((tab) => {
            const isActive = approvedSubTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.75}
                style={styles.subTabItem}
                onPress={() => setApprovedSubTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab} approved consents`}
              >
                <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                  {tab}
                </Text>
                {isActive ? <View style={styles.subTabIndicator} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 4. Content Area with ScrollView */}
      {loading && !refreshing ? (
        <LoadingState message="Loading consents..." style={styles.centerFlex} />
      ) : error ? (
        <View style={styles.errorWrapper}>
          <ErrorState
            title="Unable to load consents"
            message={error}
            onRetry={() => fetchConsents()}
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
              onRefresh={() => fetchConsents(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {filteredRecords.length === 0 ? (
            <ConsentEmptyState
              primarySegment={primarySegment}
              subTab={primarySegment === 'Requests' ? requestsSubTab : approvedSubTab}
              onRefresh={() => fetchConsents(true)}
              isRefreshing={refreshing}
            />
          ) : (
            filteredRecords.map((item) => {
              if (primarySegment === 'Approved') {
                return (
                  <GrantedCard
                    key={item._id}
                    record={item}
                    onViewMore={handleOpenDetail}
                  />
                );
              }
              return (
                <RequestCard
                  key={item._id}
                  record={item}
                  onViewMore={handleOpenDetail}
                />
              );
            })
          )}
        </ScrollView>
      )}

      {/* 5. Detail Modal ("View More") */}
      <ConsentDetailModal
        visible={modalVisible}
        record={selectedRecord}
        onClose={handleCloseDetail}
        onActionComplete={() => fetchConsents(true)}
      />
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
  headerContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...shadows.card,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnPrimary,
    letterSpacing: -0.3,
  },

  // 2. Primary Segmented Control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
    padding: 4,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  segmentText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.bold,
  },

  // 3. Sub-Tabs Row
  subTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.background,
  },
  subTabItem: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 2,
    marginRight: spacing.sm,
    position: 'relative',
    alignItems: 'center',
  },
  subTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  subTabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  subTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: spacing.xs,
    right: spacing.xs,
    height: 2.5,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  // 4. Scroll Area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 110,
    flexGrow: 1,
  },

  // 5. Consent Card
  consentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  cardHeaderTag: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
    letterSpacing: -0.2,
  },
  cardStatusCol: {
    alignItems: 'flex-end',
  },
  cardTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: typography.fontWeight.medium,
  },
  cardSection: {
    marginTop: spacing.xs,
  },
  cardSectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  cardSectionValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semiBold,
    marginTop: 2,
    lineHeight: typography.lineHeight.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semiBold,
    marginTop: 2,
  },
  viewMoreBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.mintWash,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.15)',
  },
  viewMoreBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },

  // 6. Badges
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },

  // 7. Empty State
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
    marginBottom: spacing.xl,
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
    marginBottom: spacing.xl,
    maxWidth: 320,
    lineHeight: 24,
  },
  emptyRetryButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    height: 50,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  emptyRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // 8. Modal Styles
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
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  modalHeaderTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalHeaderSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalBody: {},
  modalFieldGroup: {
    marginBottom: spacing.sm + 4,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  modalFieldValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.sm,
  },
  modalFieldValueBold: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalFieldValueSmall: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalMetaCol: {
    flex: 1,
  },
  modalErrorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalActions: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
  modalCloseActionButton: {
    marginTop: spacing.xs,
  },
});

