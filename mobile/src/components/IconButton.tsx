import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme';

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  variant?: 'default' | 'surface' | 'ghost' | 'mint';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 44,
  variant = 'ghost',
  style,
  accessibilityLabel,
  disabled = false,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'surface':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        };
      case 'mint':
        return {
          backgroundColor: colors.mintWash,
          borderWidth: 1,
          borderColor: 'rgba(10, 77, 82, 0.08)',
        };
      case 'default':
        return {
          backgroundColor: colors.surfaceSubtle,
        };
      case 'ghost':
      default:
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  const targetSize = Math.max(size, 44);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        { width: targetSize, height: targetSize, borderRadius: targetSize / 2 },
        getVariantStyle(),
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
