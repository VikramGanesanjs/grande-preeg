import { Stack } from 'expo-router';
import { colors } from '../../constants/theme';

export default function RacingLayout() {
  return (
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
    </Stack>
  );
}
