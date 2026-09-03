import React from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';

export interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tint?: 'white' | 'mint';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  onPress,
  style,
  tint = 'white',
}) => {
  const containerStyle: ViewStyle = {
    backgroundColor: tint === 'mint' ? colors.glassMint : colors.glassBackground,
    borderColor: colors.glassBorder,
    borderWidth: 1.5,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    ...shadows.soft,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        style={[containerStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};
