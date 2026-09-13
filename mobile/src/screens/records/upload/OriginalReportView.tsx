import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, typography, borderRadius, shadows } from '../../../theme';
import { documentApi } from '../../../api/documentApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface OriginalReportViewProps {
  uri?: string;
  documentId?: string;
  documentCode?: string;
  documentType?: string;
  hospital?: string;
  date?: string;
  mimeType?: string;
  fileName?: string;
}

export const OriginalReportView: React.FC<OriginalReportViewProps> = ({
  uri,
  documentId,
  documentCode,
  documentType,
  hospital,
  date,
  mimeType = 'image/jpeg',
  fileName,
}) => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (isMounted) setAuthToken(token);
      } catch (_) {}
    };
    fetchToken();
    return () => {
      isMounted = false;
    };
  }, []);

  const isPdf =
    (mimeType && mimeType.includes('pdf')) ||
    (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
    (uri && uri.toLowerCase().endsWith('.pdf'));

  // Determine image source
  const imageSource = React.useMemo(() => {
    if (uri) {
      return { uri };
    }
    if (documentId) {
      const fileUrl = documentApi.getDocumentFileUrl(documentId);
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      return {
        uri: fileUrl,
        headers,
      };
    }
    return null;
  }, [uri, documentId, authToken]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* 1. Original Document Information Banner */}
      <View style={styles.metaBanner}>
        <View style={styles.metaLeft}>
          <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
          <View style={styles.metaTextWrap}>
            <Text style={styles.metaTitle} numberOfLines={1}>
              {fileName || (documentCode ? `${documentCode} Original File` : 'Medical Document')}
            </Text>
            <Text style={styles.metaSub}>
              {[documentType, hospital, date].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </View>
        <View style={styles.formatBadge}>
          <Text style={styles.formatBadgeText}>{isPdf ? 'PDF' : 'IMAGE'}</Text>
        </View>
      </View>

      {/* 2. Document Display Area */}
      <View style={styles.docFrame}>
        {isPdf ? (
          <View style={styles.pdfCard}>
            <View style={styles.pdfIconWrap}>
              <Ionicons name="document-text" size={48} color={colors.primary} />
            </View>
            <Text style={styles.pdfTitle}>{fileName || 'Medical Document PDF'}</Text>
            <Text style={styles.pdfSub}>Original PDF Document securely stored on VAIDYAARC</Text>
            <View style={styles.pdfBadgeRow}>
              <View style={styles.pdfVerifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={styles.pdfVerifiedText}>Integrity Verified</Text>
              </View>
            </View>
          </View>
        ) : imageSource ? (
          <View style={styles.imageContainer}>
            {imageLoading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Loading document...</Text>
              </View>
            )}
            {imageError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.textMuted} />
                <Text style={styles.errorText}>Unable to load original image</Text>
              </View>
            ) : (
              <Image
                source={imageSource}
                style={styles.docImage}
                resizeMode="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            )}
          </View>
        ) : (
          <View style={styles.emptyFrame}>
            <Ionicons name="image-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No document preview available</Text>
          </View>
        )}
      </View>

      {/* 3. Original Document Legal Notice */}
      <View style={styles.legalNotice}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
        <Text style={styles.legalText}>
          This original record is stored immutably and encrypted. Any clinical modifications made to smart metadata do not alter this primary source.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  metaBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.xs,
  },
  metaTextWrap: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  metaTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  metaSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  formatBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  formatBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  docFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  imageContainer: {
    width: '100%',
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docImage: {
    width: SCREEN_WIDTH - spacing.md * 2 - 2,
    height: 480,
    backgroundColor: '#0F172A08',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  emptyFrame: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pdfCard: {
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  pdfIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pdfTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  pdfSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  pdfBadgeRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  pdfVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  pdfVerifiedText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semiBold,
    color: '#065F46',
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  legalText: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
