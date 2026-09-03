import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const DoctorProfile = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Profile</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, color: colors.textPrimary }
});
