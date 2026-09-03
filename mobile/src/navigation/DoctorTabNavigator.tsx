import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconHome, IconBell, IconFile, IconUser } from '@tabler/icons-react-native';

import { colors, spacing, shadows, typography } from '../theme';
import { DoctorTabParamList, QueueStackParamList } from './types';

// Screens
import { DoctorHome, PatientSummary } from '../screens/doctor';
import { DoctorAlerts } from '../screens/doctor/DoctorAlerts';
import { DoctorRecords } from '../screens/doctor/DoctorRecords';
import { DoctorProfile } from '../screens/doctor/DoctorProfile';

const Tab = createBottomTabNavigator<DoctorTabParamList>();
const Stack = createNativeStackNavigator<QueueStackParamList>();

const QueueStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="DoctorHome" component={DoctorHome} />
    <Stack.Screen name="PatientSummary" component={PatientSummary} />
  </Stack.Navigator>
);

const DoctorTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let IconComponent = IconHome;
          let label = 'Queue';

          if (route.name === 'Queue') {
            IconComponent = IconHome;
            label = 'Queue';
          } else if (route.name === 'Alerts') {
            IconComponent = IconBell;
            label = 'Alerts';
          } else if (route.name === 'Records') {
            IconComponent = IconFile;
            label = 'Records';
          } else if (route.name === 'DoctorProfile') {
            IconComponent = IconUser;
            label = 'Profile';
          }

          return (
            <TouchableOpacity
              key={route.name}
              activeOpacity={0.7}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <IconComponent
                size={22}
                color={isFocused ? colors.primary : colors.textMuted}
                strokeWidth={isFocused ? 2.5 : 2}
              />
              <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.textMuted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const DoctorTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <DoctorTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Queue" component={QueueStackNavigator} />
      <Tab.Screen name="Alerts" component={DoctorAlerts} />
      <Tab.Screen name="Records" component={DoctorRecords} />
      <Tab.Screen name="DoctorProfile" component={DoctorProfile} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 28,
    height: 64,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.elevated,
  },
  tabItem: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
});
