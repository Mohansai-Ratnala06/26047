import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, Input, Button, ErrorState } from '../../components';
import { colors, spacing, typography } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export const SignUpScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { signUp, loading, error, clearError } = useAuthStore();

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

  const handleSignUp = async () => {
    await signUp({ name, phone, email, abhaId, password });
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Create Account"
        subtitle="Join Vaidyaarc for intelligent healthcare"
        onBack={() => navigation.goBack()}
      />

      <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {error ? (
          <ErrorState
            title="Registration Failed"
            message={error}
            onRetry={clearError}
            style={styles.errorAlert}
          />
        ) : null}

        <Input
          label="Full Name"
          placeholder="e.g. Aarav Sharma"
          value={name}
          onChangeText={setName}
          leadingIcon={<Ionicons name="person-outline" size={18} color={colors.textMuted} />}
        />

        <Input
          label="Mobile Phone"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leadingIcon={<Ionicons name="call-outline" size={18} color={colors.textMuted} />}
        />

        <Input
          label="Email Address (Optional)"
          placeholder="e.g. aarav.sharma@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          leadingIcon={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
        />

        <Input
          label="ABHA ID (Optional)"
          placeholder="e.g. 91-4829-1029-3819"
          value={abhaId}
          onChangeText={setAbhaId}
          helperText="Ayushman Bharat Digital Health Account identifier"
          leadingIcon={<Ionicons name="card-outline" size={18} color={colors.textMuted} />}
        />

        <Input
          label="Password"
          placeholder="Create secure password"
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
          title="Complete Registration"
          size="lg"
          onPress={handleSignUp}
          loading={loading}
          style={styles.submitBtn}
          accessibilityLabel="Submit sign up form"
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already registered?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}> Sign In</Text>
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
