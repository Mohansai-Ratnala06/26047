import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';

export const TimelineSkeleton: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skeletonEpisodeBlock}>
          {/* Central Top Node & Date */}
          <View style={styles.centerNodeSection}>
            <View style={styles.centerLineShort} />
            <Animated.View style={[styles.centerNodeCircle, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.centerDatePill, { opacity: pulseAnim }]} />
            <View style={styles.centerLineShort} />
          </View>

          {/* Central Complaint Card Skeleton */}
          <Animated.View style={[styles.complaintCardSkeleton, { opacity: pulseAnim }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.shimmerBlock, { width: 70, height: 16 }]} />
              <View style={[styles.shimmerBlock, { width: 60, height: 16, borderRadius: 8 }]} />
            </View>
            <View style={[styles.shimmerBlock, { width: '85%', height: 20, marginTop: spacing.sm }]} />
            <View style={[styles.shimmerBlock, { width: '50%', height: 14, marginTop: spacing.xs }]} />
          </Animated.View>

          {/* Actions Row Skeleton (Left & Right around center line) */}
          <View style={styles.actionTreeRowSkeleton}>
            <View style={styles.rowCenterLineSkeleton} />

            {/* Left Action Skeleton */}
            <View style={styles.actionColSkeleton}>
              <Animated.View style={[styles.circleActionSkeleton, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.shimmerBlock, { width: 75, height: 12, marginTop: 6, opacity: pulseAnim }]} />
              <Animated.View style={[styles.shimmerBlock, { width: 90, height: 10, marginTop: 4, opacity: pulseAnim }]} />
            </View>

            {/* Right Action Skeleton */}
            <View style={styles.actionColSkeleton}>
              <Animated.View style={[styles.circleActionSkeleton, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.shimmerBlock, { width: 75, height: 12, marginTop: 6, opacity: pulseAnim }]} />
              <Animated.View style={[styles.shimmerBlock, { width: 90, height: 10, marginTop: 4, opacity: pulseAnim }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 80,
  },
  skeletonEpisodeBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  centerNodeSection: {
    alignItems: 'center',
  },
  centerLineShort: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
  },
  centerNodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.mintAccent,
  },
  centerDatePill: {
    width: 80,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceSubtle,
    marginTop: 4,
  },
  complaintCardSkeleton: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shimmerBlock: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
  },
  actionTreeRowSkeleton: {
    flexDirection: 'row',
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  rowCenterLineSkeleton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.border,
  },
  actionColSkeleton: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  circleActionSkeleton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surfaceSubtle,
  },
});
