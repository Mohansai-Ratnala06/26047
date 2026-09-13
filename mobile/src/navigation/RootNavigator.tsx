import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Image, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { RootStackParamList } from './types';
import { colors, spacing, typography } from '../theme';
import { DoctorTabNavigator } from './DoctorTabNavigator';
import { ClinicalResultsScreen } from '../screens/clinical';

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.error,
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isCheckingSession, startupCheck, user } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    startupCheck();
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (isCheckingSession || showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={colors.primary} style={styles.splashLoader} />
        <Text style={styles.splashTagline}>Intelligent Healthcare Ecosystem</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={AppTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user?.role === 'doctor' ? (
          <Stack.Screen name="Main" component={DoctorTabNavigator} />
        ) : !user?.onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="ClinicalResults" component={ClinicalResultsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  splashLogo: {
    width: 240,
    height: 190,
    marginBottom: spacing.lg,
  },
  splashLoader: {
    marginBottom: spacing.md,
  },
  splashTagline: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0.3,
  },
});
