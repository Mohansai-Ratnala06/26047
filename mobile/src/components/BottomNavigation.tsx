import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadows, typography } from '../theme';

export interface BottomNavigationProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isVoice = route.name === 'VoiceAgent';

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

          if (isVoice) {
            return (
              <View key={route.name} style={styles.voiceWrapper}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onPress}
                  style={[
                    styles.voiceButton,
                    isFocused ? styles.voiceButtonActive : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="VaidyaAI Voice Assistant"
                >
                  <Ionicons name="mic" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          }

          let iconName: any = 'home';
          let label = 'Home';

          if (route.name === 'Home') {
            iconName = isFocused ? 'home' : 'home-outline';
            label = 'Home';
          } else if (route.name === 'Records') {
            iconName = isFocused ? 'folder' : 'folder-outline';
            label = 'Records';
          } else if (route.name === 'Consultation') {
            iconName = isFocused ? 'shield-checkmark' : 'shield-checkmark-outline';
            label = isFocused ? 'My Consents' : 'Consents';
          } else if (route.name === 'Profile') {
            iconName = isFocused ? 'person' : 'person-outline';
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
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
  voiceWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  voiceButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadows.voiceOrb,
  },
  voiceButtonActive: {
    backgroundColor: colors.mintAccent,
  },
});
