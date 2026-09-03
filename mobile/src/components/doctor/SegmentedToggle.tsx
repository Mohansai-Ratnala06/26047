import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography } from '../../theme';

interface SegmentedToggleProps {
  options: [string, string];
  activeIndex: 0 | 1;
  onChange: (index: 0 | 1) => void;
}

export const SegmentedToggle: React.FC<SegmentedToggleProps> = ({ options, activeIndex, onChange }) => {
  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isActive = activeIndex === index;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.segment, isActive && styles.segmentActive]}
            activeOpacity={0.8}
            onPress={() => onChange(index as 0 | 1)}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 999,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textOnPrimary,
  },
});
