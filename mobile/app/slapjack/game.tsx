import React from 'react';
import { StyleSheet, View, Pressable, Text, Platform,
         TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useSlapjackMultiplayerStore } from '../../stores/slapjackMultiplayerStore';
import { Ionicons } from '@expo/vector-icons';

const NEUROJACK_URL = 'http://localhost:8080/NeuroJack_EEG.html';

export default function SlapjackGameScreen() {
  const router = useRouter();
  const {
    isMultiplayer, isLocalReady, isOpponentReady,
    opponentScore, opponentStatus, inLobby,
    setLocalReady, setInLobby,
  } = useSlapjackMultiplayerStore();

  // Auto-start when both ready
  React.useEffect(() => {
    if (isMultiplayer && inLobby && isLocalReady && isOpponentReady) {
      setInLobby(false);
    }
  }, [isMultiplayer, inLobby, isLocalReady, isOpponentReady]);

React.useEffect(() => {
  if (Platform.OS !== 'web') return;
  
  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'score_update') {
        const { broadcastScore, isMultiplayer } = 
          useSlapjackMultiplayerStore.getState();
        if (isMultiplayer) broadcastScore(data.score);
      }
    } catch (e) {}
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);

  return (
    <View style={styles.container}>
      {/* Lobby overlay — exact same pattern as racing game */}
      {isMultiplayer && inLobby && (
        <View style={styles.lobbyOverlay}>
          <View style={styles.lobbyContent}>
            <Text style={styles.lobbyTitle}>NeuroJack Multiplayer</Text>
            <Text style={styles.lobbySubtitle}>
              First to slap 5 jacks wins
            </Text>

            <View style={styles.lobbyPlayers}>
              <View style={styles.lobbyPlayer}>
                <View style={[styles.lobbyStatusDot,
                  isLocalReady && styles.lobbyStatusReady]} />
                <Text style={styles.lobbyPlayerLabel}>You</Text>
                <Text style={styles.lobbyPlayerStatus}>
                  {isLocalReady ? 'Ready!' : 'Not Ready'}
                </Text>
              </View>
              <View style={styles.lobbyPlayer}>
                <View style={[styles.lobbyStatusDot,
                  isOpponentReady && styles.lobbyStatusReady]} />
                <Text style={styles.lobbyPlayerLabel}>Opponent</Text>
                <Text style={styles.lobbyPlayerStatus}>
                  {opponentStatus === 'disconnected'
                    ? 'Disconnected'
                    : isOpponentReady ? 'Ready!' : 'Not Ready'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.readyButton,
                isLocalReady && styles.readyButtonActive]}
              onPress={() => setLocalReady(!isLocalReady)}
            >
              <Text style={[styles.readyButtonText,
                isLocalReady && styles.readyButtonTextActive]}>
                {isLocalReady ? 'Cancel Ready' : 'Ready!'}
              </Text>
            </TouchableOpacity>

            {isLocalReady && !isOpponentReady && (
              <View style={styles.waitingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.waitingText}>
                  Waiting for opponent...
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Opponent score banner (shown during multiplayer game) */}
      {isMultiplayer && !inLobby && (
        <View style={styles.scoresBanner}>
          <Text style={styles.scoresText}>
            Opponent score: {opponentScore}
          </Text>
        </View>
      )}

      {/* No header — NeuroJack HTML has its own */}
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <iframe
          src={NEUROJACK_URL}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allow="camera; microphone"
        />
      ) : (
        <NativeWebView url={NEUROJACK_URL} />
      )}
    </View>
  );
}

function NativeWebView({ url }: { url: string }) {
  const WebView = require('react-native-webview').WebView;
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1 }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowsInlineMediaPlayback={true}
      mixedContentMode="always"
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'score_update' && isMultiplayer) {
            broadcastScore(data.score);
          }
        } catch (e) {}
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04080a' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  backBtn: {
    padding: 12, margin: 8,
    backgroundColor: 'rgba(4,8,10,0.8)',
    borderRadius: 8, alignSelf: 'flex-start',
  },
  backText: { color: '#00ff88', fontSize: 16, fontWeight: '700' },
  scoresBanner: {
    position: 'absolute', top: 60, left: 0, right: 0,
    zIndex: 10, alignItems: 'center',
    backgroundColor: 'rgba(4,8,10,0.8)',
    paddingVertical: 4,
  },
  scoresText: { color: '#ff1a1a', fontSize: 14, fontWeight: '700' },
  // Lobby styles — identical to racing game
  lobbyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lobbyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%', maxWidth: 400,
  },
  lobbyTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text, marginBottom: spacing.xs,
  },
  lobbySubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textMuted,
    marginBottom: spacing.xl, textAlign: 'center',
  },
  lobbyPlayers: {
    flexDirection: 'row', justifyContent: 'space-around',
    width: '100%', marginBottom: spacing.xl,
  },
  lobbyPlayer: { alignItems: 'center', flex: 1 },
  lobbyStatusDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.textMuted,
    marginBottom: spacing.sm,
  },
  lobbyStatusReady: {
    backgroundColor: colors.concentrated,
    borderColor: colors.concentrated,
  },
  lobbyPlayerLabel: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text, marginBottom: spacing.xs,
  },
  lobbyPlayerStatus: {
    fontSize: typography.fontSizes.sm, color: colors.textMuted,
  },
  readyButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: 12, borderWidth: 2,
    borderColor: colors.primary, marginBottom: spacing.lg,
  },
  readyButtonActive: { backgroundColor: colors.primary },
  readyButtonText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  readyButtonTextActive: { color: colors.background },
  waitingContainer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  waitingText: {
    fontSize: typography.fontSizes.sm, color: colors.textMuted,
  },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnPressed: {
    backgroundColor: colors.surfaceLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 2,
  },
  headerRight: {
    width: 44, // balances the back button so title stays centered
  },
});