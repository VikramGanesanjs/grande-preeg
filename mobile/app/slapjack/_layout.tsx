import { Stack } from 'expo-router';
import { colors } from '../../constants/theme';

export default function SlapjackLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background },
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}