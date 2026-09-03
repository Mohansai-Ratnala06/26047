import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Image } from 'react-native';
import { colors, typography } from '../theme';

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUrl,
  size = 'md',
  style,
}) => {
  const getInitials = (n: string) => {
    if (!n) return 'V';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { dim: 32, font: typography.fontSize.xs };
      case 'lg':
        return { dim: 54, font: typography.fontSize.lg };
      case 'xl':
        return { dim: 72, font: typography.fontSize.xxl };
      case 'md':
      default:
        return { dim: 44, font: typography.fontSize.sm };
    }
  };

  const { dim, font } = getDimensions();

  if (imageUrl) {
    return (
      <View
        style={[
          styles.imageWrapper,
          { width: dim, height: dim, borderRadius: dim / 2 },
          style,
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dim, height: dim, borderRadius: dim / 2 },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: font }]}>{getInitials(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  imageWrapper: {
    backgroundColor: colors.surfaceSubtle,
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.mintLight,
  },
  initials: {
    color: colors.textOnPrimary,
    fontWeight: typography.fontWeight.bold,
  },
});
