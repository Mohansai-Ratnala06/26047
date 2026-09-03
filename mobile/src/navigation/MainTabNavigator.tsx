import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/home';
import { RecordsScreen } from '../screens/records';
import { VoiceAgentScreen } from '../screens/voice';
import { ConsultationScreen } from '../screens/consultation';
import { ProfileScreen } from '../screens/profile';
import { BottomNavigation } from '../components/BottomNavigation';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Records" component={RecordsScreen} />
      <Tab.Screen name="VoiceAgent" component={VoiceAgentScreen} />
      <Tab.Screen name="Consultation" component={ConsultationScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
