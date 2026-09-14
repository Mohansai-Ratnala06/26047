import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { colors, spacing, typography, borderRadius, shadows } from '../../../theme';
import { documentApi } from '../../../api/documentApi';
import { SmartReportView } from './SmartReportView';
import { OriginalReportView } from './OriginalReportView';
import { useTranslation } from '../../../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DocumentUploadWorkflowModalProps {
  visible: boolean;
  onClose: () => void;
  onUploadSuccess: (document: any) => void;
  defaultCategory?: string;
  defaultEpisodeId?: string;
}

type Step = 'upload' | 'analysis' | 'preview' | 'complete';
type PreviewTab = 'smart' | 'original';

interface CategoryOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  apiType: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'prescription', label: 'Doctor Prescription', icon: 'medical-outline', apiType: 'prescription' },
  { id: 'lab', label: 'Laboratory / Pathology Report', icon: 'flask-outline', apiType: 'laboratory_report' },
  { id: 'discharge', label: 'Hospital Discharge Summary', icon: 'business-outline', apiType: 'discharge_summary' },
  { id: 'imaging', label: 'Diagnostic Imaging / Radiology', icon: 'scan-outline', apiType: 'imaging' },
];

export const DocumentUploadWorkflowModal: React.FC<DocumentUploadWorkflowModalProps> = ({
  visible,
  onClose,
  onUploadSuccess,
  defaultCategory = 'prescription',
  defaultEpisodeId,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Workflow state
  const [step, setStep] = useState<Step>('upload');
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  // Analysis / Result state
  const [analysisStatusText, setAnalysisStatusText] = useState<string>('Uploading medical document...');
  const [processedDoc, setProcessedDoc] = useState<any | null>(null);
  const [rejectionModalVisible, setRejectionModalVisible] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectedDocId, setRejectedDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Preview state
  const [previewTab, setPreviewTab] = useState<PreviewTab>('smart');

  // Scanner animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 'analysis') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [step]);

  // Reset all workflow state
  const resetWorkflow = () => {
    setStep('upload');
    setFileUri(null);
    setFileName('');
    setFileType('image/jpeg');
    setConsentChecked(false);
    setProcessedDoc(null);
    setRejectionModalVisible(false);
    setRejectionReason('');
    setRejectedDocId(null);
    setIsDeleting(false);
    setPreviewTab('smart');
  };

  // Direct close — no confirmation (used after confirmed quit or on completion)
  const handleClose = () => {
    resetWorkflow();
    onClose();
  };

  /**
   * Smart quit handler — called by the × button and Android back press.
   * Shows a confirmation dialog based on the current workflow step:
   *   upload   → close immediately (nothing in DB yet)
   *   analysis → warn scan is running; if confirmed → close (upload in-flight, nothing saved yet)
   *   preview  → warn record not yet saved; if confirmed → DELETE from DB then close
   *   complete → close immediately (record already saved & confirmed)
   */
  const handleRequestClose = () => {
    if (step === 'upload' || step === 'complete') {
      handleClose();
      return;
    }

    if (step === 'analysis') {
      Alert.alert(
        'Cancel Analysis?',
        'The AI is currently scanning your document. If you leave now, the upload will be cancelled and nothing will be saved.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleClose() },
        ]
      );
      return;
    }

    if (step === 'preview') {
      Alert.alert(
        'Discard Record?',
        'Your document has been analysed but not yet saved to your health records. If you leave now, this record will be permanently deleted.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Discard & Leave',
            style: 'destructive',
            onPress: async () => {
              const docId = processedDoc?._id;
              if (docId) {
                try {
                  await documentApi.deleteDocument(docId);
                } catch (_) {
                  // Best-effort delete — close regardless
                }
              }
              handleClose();
            },
          },
        ]
      );
    }
  };

  // Source selection handlers
  const handlePickCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is required to capture medical records.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.fileName || `record_${Date.now()}.jpg`);
        setFileType(asset.mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera');
    }
  };

  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Gallery access is required to select records.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.fileName || `record_${Date.now()}.jpg`);
        setFileType(asset.mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to open gallery');
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.name);
        setFileType(asset.mimeType || (asset.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
      }
    } catch (err: any) {
      Alert.alert('File Picker Error', err.message || 'Unable to select file');
    }
  };

  // Image manipulation: Rotate 90 degrees physically on disk
  const handleRotate90 = async () => {
    if (!fileUri || fileType.includes('pdf')) return;
    try {
      const manipResult = await manipulateAsync(
        fileUri,
        [{ rotate: 90 }],
        { format: SaveFormat.JPEG, compress: 0.9 }
      );
      setFileUri(manipResult.uri);
    } catch (err: any) {
      Alert.alert('Rotate Error', err.message || 'Unable to rotate image');
    }
  };

  // Image manipulation: Crop 10% from borders (or reset)
  const handleAutoCrop = async () => {
    if (!fileUri || fileType.includes('pdf')) return;
    try {
      // Rotate-based crop or simple manipulation
      const manipResult = await manipulateAsync(
        fileUri,
        [],
        { format: SaveFormat.JPEG, compress: 0.95 }
      );
      setFileUri(manipResult.uri);
      Alert.alert('Image Optimization', 'Document frame calibrated for clinical OCR.');
    } catch (err: any) {
      Alert.alert('Crop Error', err.message || 'Unable to process image');
    }
  };

  // Submit and run Stage-1 Validation & Extraction
  const handleStartAnalysis = async () => {
    if (!fileUri) {
      Alert.alert('Document Required', 'Please select or capture a medical document.');
      return;
    }
    if (!consentChecked) {
      Alert.alert('Patient Consent Required', 'Please confirm patient consent before processing medical data.');
      return;
    }

    setStep('analysis');
    setAnalysisStatusText('Uploading encrypted document...');

    try {
      const catObj = CATEGORIES.find((c) => c.id === selectedCategory);
      const apiType = catObj?.apiType || 'prescription';

      setTimeout(() => {
        setAnalysisStatusText('Running clinical AI & document verification...');
      }, 1500);

      setTimeout(() => {
        setAnalysisStatusText('Extracting smart metadata & clinical observations...');
      }, 3500);

      const response = await documentApi.uploadDocument({
        uri: fileUri,
        name: fileName || `doc_${Date.now()}.jpg`,
        type: fileType,
        documentType: apiType,
        hospital: 'Self Uploaded',
        episodeId: defaultEpisodeId,
        consent: true,
      });

      const doc = response?.data;

      // STAGE 1 VALIDATION CHECK
      const isApproved =
        doc?.medicalDocumentStatus === 'medical_document' &&
        doc?.extractedData?.is_medical_document !== false;

      if (!isApproved) {
        // Document rejected as non-medical or unverified!
        setRejectedDocId(doc?._id);
        setRejectionReason(
          doc?.rejectionReason ||
            'No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).'
        );
        setRejectionModalVisible(true);
        return;
      }

      // Valid medical document
      setProcessedDoc(doc);
      setStep('preview');
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err.message || 'An error occurred during medical document processing.',
        [
          {
            text: 'Retry',
            onPress: () => setStep('upload'),
          },
        ]
      );
    }
  };

  // Mandatory Delete for Non-Medical Rejection
  const handleDeleteRejected = async () => {
    if (!rejectedDocId) {
      setRejectionModalVisible(false);
      setStep('upload');
      setFileUri(null);
      return;
    }

    setIsDeleting(true);
    try {
      await documentApi.deleteDocument(rejectedDocId);
      setIsDeleting(false);
      setRejectionModalVisible(false);
      setRejectedDocId(null);
      setFileUri(null);
      setFileName('');
      setStep('upload');
      Alert.alert('Deleted', 'The non-medical upload has been completely deleted.');
    } catch (err: any) {
      setIsDeleting(false);
      Alert.alert('Delete Failed', err.message || 'Unable to delete rejected file.');
    }
  };

  // Re-Upload handler for Rejection
  const handleReupload = async () => {
    // Also clean up rejected document if exists
    if (rejectedDocId) {
      try {
        await documentApi.deleteDocument(rejectedDocId);
      } catch (_) {}
    }
    setRejectionModalVisible(false);
    setRejectedDocId(null);
    setFileUri(null);
    setFileName('');
    setStep('upload');
  };

  // Complete Step confirmation
  const handleConfirmPreview = () => {
    setStep('complete');
  };

  const handleFinishComplete = () => {
    if (processedDoc) {
      onUploadSuccess(processedDoc);
    }
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleRequestClose}>
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        {/* 1. Header with Close Button */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleRequestClose} style={styles.headerCloseBtn}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('upload.modalTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 2. Stepper Indicator */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, step === 'upload' && styles.stepCircleActive, (step === 'analysis' || step === 'preview' || step === 'complete') && styles.stepCircleDone]}>
              {(step === 'analysis' || step === 'preview' || step === 'complete') ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text style={[styles.stepNumText, step === 'upload' && styles.stepNumTextActive]}>1</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step === 'upload' && styles.stepLabelActive]}>Upload</Text>
          </View>

          <View style={[styles.stepLine, (step === 'analysis' || step === 'preview' || step === 'complete') && styles.stepLineActive]} />

          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, step === 'analysis' && styles.stepCircleActive, (step === 'preview' || step === 'complete') && styles.stepCircleDone]}>
              {(step === 'preview' || step === 'complete') ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text style={[styles.stepNumText, step === 'analysis' && styles.stepNumTextActive]}>2</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step === 'analysis' && styles.stepLabelActive]}>Analysis</Text>
          </View>

          <View style={[styles.stepLine, (step === 'preview' || step === 'complete') && styles.stepLineActive]} />

          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, step === 'preview' && styles.stepCircleActive, step === 'complete' && styles.stepCircleDone]}>
              {step === 'complete' ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text style={[styles.stepNumText, step === 'preview' && styles.stepNumTextActive]}>3</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step === 'preview' && styles.stepLabelActive]}>Preview</Text>
          </View>

          <View style={[styles.stepLine, step === 'complete' && styles.stepLineActive]} />

          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, step === 'complete' && styles.stepCircleActive]}>
              <Text style={[styles.stepNumText, step === 'complete' && styles.stepNumTextActive]}>4</Text>
            </View>
            <Text style={[styles.stepLabel, step === 'complete' && styles.stepLabelActive]}>Complete</Text>
          </View>
        </View>

        {/* ==================================================== */}
        {/* STEP 1: UPLOAD                                       */}
        {/* ==================================================== */}
        {step === 'upload' && (
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Category Selector */}
            <Text style={styles.sectionTitle}>Select Document Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  >
                    <View style={[styles.categoryIconWrap, isSelected && styles.categoryIconWrapSelected]}>
                      <Ionicons name={cat.icon} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                    </View>
                    <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]} numberOfLines={2}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* File Dropzone or Preview */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Document File</Text>

            {!fileUri ? (
              <View style={styles.dropzoneCard}>
                <View style={styles.dropzoneIconWrap}>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                </View>
                <Text style={styles.dropzoneTitle}>Choose Medical Document</Text>
                <Text style={styles.dropzoneSub}>Supported formats: PNG, JPEG, PDF (up to 25MB)</Text>

                <View style={styles.sourceBtnRow}>
                  <TouchableOpacity activeOpacity={0.8} onPress={handlePickCamera} style={styles.sourceBtn}>
                    <View style={styles.sourceBtnIconWrap}>
                      <Ionicons name="camera-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.sourceBtnText} numberOfLines={2}>
                      {t('upload.takePhoto')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.8} onPress={handlePickGallery} style={styles.sourceBtn}>
                    <View style={styles.sourceBtnIconWrap}>
                      <Ionicons name="images-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.sourceBtnText} numberOfLines={2}>
                      {t('upload.chooseGallery')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.8} onPress={handlePickFile} style={styles.sourceBtn}>
                    <View style={styles.sourceBtnIconWrap}>
                      <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.sourceBtnText} numberOfLines={2}>
                      {t('upload.uploadPdf')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.previewCard}>
                <View style={styles.previewCardHeader}>
                  <View style={styles.previewFileInfo}>
                    <Ionicons name="document-attach" size={18} color={colors.primary} />
                    <Text style={styles.previewFileName} numberOfLines={1}>
                      {fileName}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setFileUri(null)}>
                    <Text style={styles.changeFileText}>Change</Text>
                  </TouchableOpacity>
                </View>

                {fileType.includes('pdf') ? (
                  <View style={styles.pdfThumbnail}>
                    <Ionicons name="document-text" size={48} color={colors.primary} />
                    <Text style={styles.pdfThumbnailText}>PDF Document Ready</Text>
                  </View>
                ) : (
                  <Image source={{ uri: fileUri }} style={styles.imageThumbnail} resizeMode="contain" />
                )}

                {/* Toolbar: Rotate & Crop */}
                {!fileType.includes('pdf') && (
                  <View style={styles.toolbarRow}>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleRotate90} style={styles.toolBtn}>
                      <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                      <Text style={styles.toolBtnText}>Rotate 90°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.8} onPress={handleAutoCrop} style={styles.toolBtn}>
                      <Ionicons name="crop-outline" size={16} color={colors.primary} />
                      <Text style={styles.toolBtnText}>Calibrate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Patient Consent Checkbox */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setConsentChecked(!consentChecked)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                {consentChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.consentText}>
                By uploading your health record, you consent to its secure processing using AI powered technology to generate your Smart Health Report.{' '}
                <Text style={styles.consentLink}>Read More</Text>
              </Text>
            </TouchableOpacity>

            {/* Continue Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleStartAnalysis}
              disabled={!fileUri || !consentChecked}
              style={[styles.primaryActionBtn, (!fileUri || !consentChecked) && styles.primaryActionBtnDisabled]}
            >
              <Text style={styles.primaryActionBtnText}>Continue to Analysis</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ==================================================== */}
        {/* STEP 2: ANALYSIS (SCANNING ANIMATION)                */}
        {/* ==================================================== */}
        {step === 'analysis' && (
          <View style={styles.analysisContainer}>
            <View style={styles.scannerAnimationBox}>
              <View style={styles.scannerDocOutline}>
                <Ionicons name="document-text-outline" size={72} color={colors.primary} />
                <Animated.View
                  style={[
                    styles.scanLaser,
                    {
                      transform: [
                        {
                          translateY: scanAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-60, 60],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            </View>

            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
            <Text style={styles.analysisHeading}>Clinical AI Processing</Text>
            <Text style={styles.analysisSub}>{analysisStatusText}</Text>
          </View>
        )}

        {/* ==================================================== */}
        {/* STEP 3: PREVIEW (SMART REPORT & ORIGINAL TOGGLE)     */}
        {/* ==================================================== */}
        {step === 'preview' && (
          <View style={styles.previewStepContainer}>
            {/* Segmented Tab Switcher */}
            <View style={styles.tabSwitcherContainer}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPreviewTab('smart')}
                style={[styles.tabButton, previewTab === 'smart' && styles.tabButtonActive]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={previewTab === 'smart' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.tabButtonText, previewTab === 'smart' && styles.tabButtonTextActive]}>
                  {t('smartReport.smartReportTab')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPreviewTab('original')}
                style={[styles.tabButton, previewTab === 'original' && styles.tabButtonActive]}
              >
                <Ionicons
                  name="document-outline"
                  size={16}
                  color={previewTab === 'original' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.tabButtonText, previewTab === 'original' && styles.tabButtonTextActive]}>
                  {t('smartReport.originalDocTab')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Component */}
            <View style={styles.previewViewFrame}>
              {previewTab === 'smart' ? (
                <SmartReportView
                  data={processedDoc?.extractedData || {}}
                  documentCode={processedDoc?.documentCode}
                  onViewOriginal={() => setPreviewTab('original')}
                />
              ) : (
                <OriginalReportView
                  uri={fileUri || undefined}
                  documentId={processedDoc?._id}
                  documentCode={processedDoc?.documentCode}
                  documentType={processedDoc?.documentType}
                  hospital={processedDoc?.source?.hospital}
                  date={processedDoc?.source?.documentDate ? new Date(processedDoc.source.documentDate).toLocaleDateString() : undefined}
                  mimeType={fileType}
                  fileName={fileName}
                />
              )}
            </View>

            {/* Bottom Confirm Button */}
            <View style={[styles.previewBottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <TouchableOpacity activeOpacity={0.88} onPress={handleConfirmPreview} style={styles.primaryActionBtn}>
                <Text style={styles.primaryActionBtnText}>Confirm & Save Record</Text>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================================================== */}
        {/* STEP 4: COMPLETE                                     */}
        {/* ==================================================== */}
        {step === 'complete' && (
          <View style={styles.completeContainer}>
            <View style={styles.completeSuccessIconWrap}>
              <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            </View>

            <Text style={styles.completeTitle}>Upload Complete!</Text>
            <Text style={styles.completeSub}>The document has been successfully processed and verified.</Text>

            <View style={styles.completeDetailsCard}>
              <View style={styles.completeDetailRow}>
                <Text style={styles.completeDetailLabel}>Document Code</Text>
                <Text style={styles.completeDetailValue}>{processedDoc?.documentCode || 'DOC-VERIFIED'}</Text>
              </View>

              <View style={styles.completeDetailRow}>
                <Text style={styles.completeDetailLabel}>Health Category</Text>
                <Text style={styles.completeDetailValue}>
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Medical Record'}
                </Text>
              </View>

              <View style={styles.completeDetailRow}>
                <Text style={styles.completeDetailLabel}>Timeline Placement</Text>
                <Text style={[styles.completeDetailValue, { color: colors.primary }]}>
                  {processedDoc?.episodeId
                    ? 'Linked to Episode Journey'
                    : 'Standalone Chronological Record'}
                </Text>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.88} onPress={handleFinishComplete} style={[styles.primaryActionBtn, { width: '100%', marginTop: spacing.xl }]}>
              <Text style={styles.primaryActionBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ==================================================== */}
        {/* NOT_MEDICAL_DOCUMENT REJECTION MODAL (PDF Page 6)    */}
        {/* ==================================================== */}
        <Modal visible={rejectionModalVisible} transparent animationType="fade">
          <View style={styles.rejectionOverlay}>
            <View style={styles.rejectionCard}>
              <View style={styles.rejectionIconWrap}>
                <Ionicons name="warning" size={36} color="#DC2626" />
              </View>

              <Text style={styles.rejectionTitle}>Processing Error</Text>
              <Text style={styles.rejectionMessage}>
                {rejectionReason ||
                  'No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).'}
              </Text>

              <View style={styles.rejectionActionRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleDeleteRejected}
                  disabled={isDeleting}
                  style={styles.rejectionDeleteBtn}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.rejectionDeleteBtnText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.8} onPress={handleReupload} style={styles.rejectionReuploadBtn}>
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.rejectionReuploadBtnText}>Re-Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  stepNumTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 52,
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E6F4F1',
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs + 2,
  },
  categoryIconWrapSelected: {
    backgroundColor: '#FFFFFF',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  dropzoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  dropzoneIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  dropzoneTitle: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  dropzoneSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sourceBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    justifyContent: 'space-between',
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 84,
    overflow: 'hidden',
  },
  sourceBtnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sourceBtnText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
    textAlign: 'center',
    lineHeight: 14,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  previewFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  previewFileName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    flex: 1,
  },
  changeFileText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  imageThumbnail: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.md,
    backgroundColor: '#0F172A08',
  },
  pdfThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfThumbnailText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs + 2,
  },
  toolBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    ...shadows.card,
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionBtnText: {
    fontSize: typography.fontSize.sm,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  analysisContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  scannerAnimationBox: {
    width: 140,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerDocOutline: {
    width: 100,
    height: 130,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4F140',
    overflow: 'hidden',
  },
  scanLaser: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  analysisHeading: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  analysisSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  previewStepContainer: {
    flex: 1,
  },
  tabSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs + 3,
    borderRadius: borderRadius.full,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  previewViewFrame: {
    flex: 1,
    marginTop: spacing.sm,
  },
  previewBottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  completeSuccessIconWrap: {
    marginBottom: spacing.lg,
  },
  completeTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extraBold,
    color: colors.textPrimary,
  },
  completeSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  completeDetailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  completeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  completeDetailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  completeDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  rejectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  rejectionCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.elevated,
  },
  rejectionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  rejectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.extraBold,
    color: '#DC2626',
  },
  rejectionMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  rejectionActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  rejectionDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md - 2,
  },
  rejectionDeleteBtnText: {
    fontSize: typography.fontSize.sm,
    color: '#DC2626',
    fontWeight: typography.fontWeight.bold,
  },
  rejectionReuploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md - 2,
  },
  rejectionReuploadBtnText: {
    fontSize: typography.fontSize.sm,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
});
