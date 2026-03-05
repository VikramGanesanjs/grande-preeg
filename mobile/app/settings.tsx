import React from 'react';
import { StyleSheet, View, Text, Switch, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';

export default function SettingsScreen() {
  const router = useRouter();
  
  // Settings state
  const {
    concentrationThreshold,
    serverUrl,
    soundEnabled,
    hapticsEnabled,
    devModeEnabled,
    setConcentrationThreshold,
    setServerUrl,
    setSoundEnabled,
    setHapticsEnabled,
    setDevModeEnabled,
  } = useSettingsStore();
  
  // Connection state
  const connect = useConnectionStore((state) => state.connect);
  const disconnect = useConnectionStore((state) => state.disconnect);
  
  const handleThresholdChange = (value: 3 | 5) => {
    setConcentrationThreshold(value);
  };
  
  const handleServerUrlChange = (url: string) => {
    setServerUrl(url);
  };
  
  const handleReconnect = () => {
    disconnect();
    setTimeout(() => connect(serverUrl), 500);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Game Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Settings</Text>
          
          {/* Concentration Threshold */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="flash" size={20} color={colors.primary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Focus Streak Required</Text>
                <Text style={styles.settingDescription}>
                  Consecutive focus signals needed to advance
                </Text>
              </View>
            </View>
            <View style={styles.thresholdSelector}>
              <Pressable
                style={[
                  styles.thresholdOption,
                  concentrationThreshold === 3 && styles.thresholdOptionActive,
                ]}
                onPress={() => handleThresholdChange(3)}
              >
                <Text
                  style={[
                    styles.thresholdText,
                    concentrationThreshold === 3 && styles.thresholdTextActive,
                  ]}
                >
                  3
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.thresholdOption,
                  concentrationThreshold === 5 && styles.thresholdOptionActive,
                ]}
                onPress={() => handleThresholdChange(5)}
              >
                <Text
                  style={[
                    styles.thresholdText,
                    concentrationThreshold === 5 && styles.thresholdTextActive,
                  ]}
                >
                  5
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        
        {/* Feedback Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          
          {/* Sound */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={20} color={colors.secondary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Sound Effects</Text>
                <Text style={styles.settingDescription}>
                  Play sounds during gameplay
                </Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
              thumbColor={soundEnabled ? colors.primary : colors.textMuted}
            />
          </View>
          
          {/* Haptics */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait" size={20} color={colors.secondary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Haptic Feedback</Text>
                <Text style={styles.settingDescription}>
                  Vibrate when car advances
                </Text>
              </View>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
              thumbColor={hapticsEnabled ? colors.primary : colors.textMuted}
            />
          </View>
        </View>
        
        {/* Developer Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          
          {/* Dev Mode */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="bug" size={20} color={colors.warning} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Dev Mode</Text>
                <Text style={styles.settingDescription}>
                  Show raw EEG data during gameplay
                </Text>
              </View>
            </View>
            <Switch
              value={devModeEnabled}
              onValueChange={setDevModeEnabled}
              trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
              thumbColor={devModeEnabled ? colors.primary : colors.textMuted}
            />
          </View>
          
          {/* Server URL */}
          <View style={styles.settingRowVertical}>
            <View style={styles.settingInfo}>
              <Ionicons name="server" size={20} color={colors.textMuted} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Server URL</Text>
                <Text style={styles.settingDescription}>
                  WebSocket server address
                </Text>
              </View>
            </View>
            <TextInput
              style={styles.textInput}
              value={serverUrl}
              onChangeText={handleServerUrlChange}
              placeholder="http://localhost:3001"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Pressable
              style={({ pressed }) => [
                styles.reconnectButton,
                pressed && styles.reconnectButtonPressed,
              ]}
              onPress={handleReconnect}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.reconnectText}>Reconnect</Text>
            </Pressable>
          </View>
        </View>
        
        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>EEG Racing v1.0.0</Text>
          <Text style={styles.footerSubtext}>Race with your mind</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  settingRowVertical: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  settingDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  thresholdSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  thresholdOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thresholdOptionActive: {
    backgroundColor: colors.primary,
  },
  thresholdText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
  },
  thresholdTextActive: {
    color: colors.text,
  },
  textInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontFamily: 'monospace',
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  reconnectButtonPressed: {
    opacity: 0.7,
  },
  reconnectText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  footerSubtext: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
