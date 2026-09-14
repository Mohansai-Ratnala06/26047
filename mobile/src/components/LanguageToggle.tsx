import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, SupportedLanguage, LANGUAGE_OPTIONS } from '../i18n';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export interface LanguageToggleProps {
  style?: StyleProp<ViewStyle>;
  variant?: 'pill' | 'icon-only';
  showModalOnPress?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  style,
  variant = 'pill',
  showModalOnPress = false,
}) => {
  const { currentLanguage, setLanguage, cycleLanguage, currentOption } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    if (showModalOnPress) {
      setModalVisible(true);
    } else {
      // 1-tap instant switch: EN -> TE -> HI -> EN
      cycleLanguage();
    }
  };

  const handleLongPress = () => {
    setModalVisible(true);
  };

  const handleSelectLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.container, variant === 'icon-only' && styles.iconOnlyContainer, style]}
        accessibilityRole="button"
        accessibilityLabel={`Language toggle, current language: ${currentOption.label}. Tap to switch language.`}
        accessibilityHint="Tap to switch between English, Telugu, and Hindi instantly"
      >
        {/* Globe Icon */}
        <Ionicons name="globe-outline" size={19} color={colors.primaryDark} />

        {variant === 'pill' && (
          <View style={styles.labelWrapper}>
            <Text style={styles.langCodeText}>{currentOption.shortLabel}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Quick Language Selector Modal (accessible on long press or modal mode) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="globe-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Choose Language / భాష / भाषा</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = currentLanguage === opt.code;
                return (
                  <TouchableOpacity
                    key={opt.code}
                    activeOpacity={0.8}
                    onPress={() => handleSelectLanguage(opt.code)}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemActive,
                    ]}
                  >
                    <View>
                      <Text
                        style={[
                          styles.optionNativeLabel,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {opt.nativeLabel}
                      </Text>
                      <Text style={styles.optionSubLabel}>{opt.label}</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 5,
    minHeight: 38,
    ...shadows.card,
  },
  iconOnlyContainer: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 20,
  },
  labelWrapper: {
    backgroundColor: colors.mintWash,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  langCodeText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    letterSpacing: 0.3,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  optionsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionItemActive: {
    backgroundColor: colors.mintWash,
    borderColor: 'rgba(10, 77, 82, 0.25)',
  },
  optionNativeLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  optionSubLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionTextActive: {
    color: colors.primaryDark,
  },
  radioUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
});
