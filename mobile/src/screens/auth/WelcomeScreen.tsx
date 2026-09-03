import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Card, GlassCard, Button, Badge } from '../../components';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export const WelcomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { demoBypass } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <ScreenContainer scrollable contentContainerStyle={styles.container}>
      <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.iconOrb}>
          <Ionicons name="fitness" size={44} color="#FFFFFF" />
        </View>

        <Badge label="Clinical Intelligence Platform" variant="mint" style={styles.topBadge} />

        <Text style={styles.brandTitle}>Vaidyaarc</Text>
        <Text style={styles.tagline}>
          High-trust clinical intelligence, seamless telemedicine, and unified health records.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.featureGlass, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <GlassCard tint="mint">
          <View style={styles.featureRow}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Foundational Health Architecture</Text>
              <Text style={styles.featureDesc}>
                Designed for patients and clinicians with digital health card identity, modular consent, and AI consultation support.
              </Text>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View style={[styles.ctaSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Button
          title="Sign In"
          size="lg"
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Sign In to your account"
        />
        <Button
          title="Create New Account"
          variant="secondary"
          size="lg"
          onPress={() => navigation.navigate('SignUp')}
          accessibilityLabel="Create a new account"
        />
        <Button
          title="Explore Demo (Instant Access)"
          variant="ghost"
          size="sm"
          onPress={demoBypass}
          accessibilityLabel="Explore demo preview"
          style={styles.demoBtn}
        />
      </Animated.View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    flexGrow: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  iconOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  topBadge: {
    marginBottom: spacing.sm,
  },
  brandTitle: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: typography.lineHeight.sm,
    maxWidth: 300,
  },
  featureGlass: {
    marginVertical: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  featureDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: typography.lineHeight.xs,
  },
  ctaSection: {
    gap: spacing.sm + 2,
  },
  demoBtn: {
    marginTop: spacing.xs,
  },
});
