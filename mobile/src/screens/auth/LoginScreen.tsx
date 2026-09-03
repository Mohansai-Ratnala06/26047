import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, Input, Button, Card, ErrorState } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('+91 98765 43210');
  const [password, setPassword] = useState('••••••••');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { login, loading, error, clearError } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    await login({ identifier, password });
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Welcome Back"
        subtitle="Sign in to your Vaidyaarc account"
        onBack={() => navigation.goBack()}
      />

      <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {error ? (
          <ErrorState
            title="Authentication Failed"
            message={error}
            onRetry={clearError}
            style={styles.errorAlert}
          />
        ) : null}

        <Input
          label="Phone Number"
          placeholder="e.g. +91 98765 43210"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="phone-pad"
          leadingIcon={<Ionicons name="call-outline" size={18} color={colors.textMuted} />}
        />

        <Input
          label="Password"
          placeholder="Enter your account password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          leadingIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />}
          trailingIcon={
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} accessibilityLabel="Toggle password visibility">
              <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          }
        />

        <Button
          title="Sign In"
          size="lg"
          onPress={handleLogin}
          loading={loading}
          style={styles.submitBtn}
          accessibilityLabel="Submit login form"
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}> Create One</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    marginTop: spacing.md,
  },
  errorAlert: {
    marginBottom: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});
