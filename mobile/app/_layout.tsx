import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '../constants/theme';
import { useConnectionStore } from '../stores/connectionStore';

export default function RootLayout() {
  const connect = useConnectionStore((state) => state.connect);

  useEffect(() => {
    // Auto-connect to WebSocket server on app launch
    connect();
  }, [connect]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'EEG Racing',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="game"
          options={{
            title: 'Race',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="results"
          options={{
            title: 'Results',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
