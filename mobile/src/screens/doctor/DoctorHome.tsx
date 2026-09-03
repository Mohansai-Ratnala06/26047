import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { IconBell } from '@tabler/icons-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { QueueStackParamList } from '../../navigation/types';
import { colors, typography, spacing } from '../../theme';
import { MetricCard, PatientRow } from '../../components/doctor';

interface DoctorHomeProps {
  navigation: NativeStackNavigationProp<QueueStackParamList, 'DoctorHome'>;
}

const queue = [
  { token: '07', name: 'Ramesh Iyer', age: 58, gender: 'male', complaint: 'chest pain, breathless', status: 'priority' as const },
  { token: '03', name: 'Sunita Devi', age: 34, gender: 'female', complaint: 'fever, cough', status: 'ready' as const },
  { token: '04', name: 'Arjun Mehta', age: 45, gender: 'male', complaint: 'follow-up, diabetes', status: 'processing' as const },
];

export const DoctorHome: React.FC<DoctorHomeProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Row */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.doctorName}>Dr. Meera Rao</Text>
            <Text style={styles.subtitle}>Cardiology OPD · Room 4</Text>
          </View>
          <View style={styles.bellContainer}>
            <IconBell size={22} color={colors.textPrimary} />
            <View style={styles.badge} />
          </View>
        </View>

        {/* Metric Row */}
        <View style={styles.metricRow}>
          <MetricCard label="Waiting" value="12" />
          <MetricCard label="Red flags" value="2" valueColor="danger" />
          <MetricCard label="Avg wait" value="14m" />
        </View>

        {/* Queue Section */}
        <Text style={styles.sectionLabel}>Queue</Text>
        <View style={styles.queueList}>
          {queue.map((patient) => (
            <PatientRow
              key={patient.token}
              {...patient}
              onPress={() => navigation.navigate('PatientSummary', { patientId: patient.token })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  doctorName: { fontSize: 18, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: colors.textMuted },
  bellContainer: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dangerFill,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginHorizontal: -4,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  queueList: {
    gap: 8,
  },
});
