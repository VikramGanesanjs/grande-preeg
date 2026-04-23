import React from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import Svg, { Rect, Line, Defs, Pattern, G } from 'react-native-svg';
import { colors, typography, spacing } from '../../constants/theme';
import { Car } from './Car';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RaceTrackProps {
  carPosition: number; // 0-100 percentage
  isConcentrated: boolean;
  opponentPosition?: number; // 0-100 percentage (optional for multiplayer)
  /** When false, opponent lane is dimmed (e.g. disconnected from multiplayer server). */
  opponentConnected?: boolean;
  showOpponent?: boolean;
  trackWidth?: number;
  trackHeight?: number;
}

export function RaceTrack({
  carPosition,
  isConcentrated,
  opponentPosition = 0,
  opponentConnected = true,
  showOpponent = false,
  trackWidth = SCREEN_WIDTH - 48,
  trackHeight = 120,  // Increased height for two cars
}: RaceTrackProps) {
  const laneCount = 5;
  const laneWidth = trackWidth / laneCount;

  return (
    <View style={styles.container}>
      {/* Track background */}
      <View style={[styles.track, { width: trackWidth, height: trackHeight }]}>
        <Svg width={trackWidth} height={trackHeight} style={styles.trackSvg}>
          {/* Track surface */}
          <Rect
            x={0}
            y={0}
            width={trackWidth}
            height={trackHeight}
            fill={colors.trackBackground}
            rx={8}
          />
          
          {/* Track border */}
          <Rect
            x={2}
            y={2}
            width={trackWidth - 4}
            height={trackHeight - 4}
            fill="none"
            stroke={colors.trackBorder}
            strokeWidth={2}
            rx={6}
          />
          
          {/* Lane markings */}
          {Array.from({ length: laneCount - 1 }).map((_, index) => {
            const x = (index + 1) * laneWidth;
            return (
              <G key={index}>
                {/* Dashed lane lines */}
                {Array.from({ length: 8 }).map((_, dashIndex) => {
                  const dashWidth = 15;
                  const gapWidth = 10;
                  const startX = x - 1;
                  const dashY = 10 + dashIndex * (dashWidth + gapWidth);
                  
                  if (dashY + dashWidth > trackHeight - 10) return null;
                  
                  return (
                    <Line
                      key={dashIndex}
                      x1={startX}
                      y1={dashY}
                      x2={startX}
                      y2={dashY + dashWidth}
                      stroke={colors.trackLane}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                })}
              </G>
            );
          })}
          
          {/* Start line */}
          <Line
            x1={20}
            y1={10}
            x2={20}
            y2={trackHeight - 10}
            stroke={colors.text}
            strokeWidth={3}
            strokeDasharray="5,5"
          />
          
          {/* Finish line */}
          <G>
            <Rect
              x={trackWidth - 25}
              y={10}
              width={15}
              height={trackHeight - 20}
              fill="none"
              stroke={colors.text}
              strokeWidth={2}
            />
            {/* Checkered pattern */}
            {Array.from({ length: 4 }).map((_, row) =>
              Array.from({ length: 2 }).map((_, col) => (
                <Rect
                  key={`${row}-${col}`}
                  x={trackWidth - 25 + col * 7.5 + ((row % 2) * 7.5)}
                  y={10 + row * ((trackHeight - 20) / 4)}
                  width={7.5}
                  height={(trackHeight - 20) / 4}
                  fill={(row + col) % 2 === 0 ? colors.text : 'transparent'}
                />
              ))
            )}
          </G>
        </Svg>
        
        {/* Cars on track */}
        {showOpponent ? (
          <>
            {/* Player car (top lane) */}
            <View style={styles.playerLaneContainer}>
              <View style={styles.carLabelContainer}>
                <Text style={[styles.carLabel, styles.playerLabel]}>You</Text>
              </View>
              <View style={styles.playerCarContainer}>
                <Car
                  position={carPosition}
                  isConcentrated={isConcentrated}
                  color={colors.playerCar}
                  size={45}
                />
              </View>
            </View>

            {/* Opponent car (bottom lane) — position from shared multiplayer server */}
            <View
              style={[
                styles.opponentLaneContainer,
                !opponentConnected && styles.opponentLaneDisconnected,
              ]}
            >
              <View style={styles.carLabelContainer}>
                <Text style={[styles.carLabel, styles.opponentLabel]}>
                  {opponentConnected ? 'Opponent' : 'Opponent (offline)'}
                </Text>
              </View>
              <View style={styles.opponentCarContainer}>
                <Car
                  position={opponentPosition}
                  isConcentrated={false}
                  color={colors.opponentCar}
                  size={45}
                />
              </View>
            </View>
          </>
        ) : (
          /* Single player mode - centered car */
          <View style={styles.carContainer}>
            <Car
              position={carPosition}
              isConcentrated={isConcentrated}
              color={colors.playerCar}
            />
          </View>
        )}
      </View>
      
      {/* Progress markers */}
      <View style={[styles.progressMarkers, { width: trackWidth }]}>
        {[0, 25, 50, 75, 100].map((marker) => (
          <View
            key={marker}
            style={[
              styles.marker,
              { left: `${marker}%` },
              carPosition >= marker && styles.markerActive,
            ]}
          >
            <View style={[
              styles.markerDot,
              carPosition >= marker && styles.markerDotActive,
            ]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  track: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  trackSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  carContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 25,
    transform: [{ translateY: -18 }],
  },
  playerLaneContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: '45%',
  },
  opponentLaneContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    height: '45%',
  },
  opponentLaneDisconnected: {
    opacity: 0.5,
  },
  carLabelContainer: {
    position: 'absolute',
    left: 4,
    top: 2,
    zIndex: 10,
  },
  carLabel: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  opponentLabel: {
    backgroundColor: colors.opponentCar,
    color: '#fff',
  },
  playerLabel: {
    backgroundColor: colors.playerCar,
    color: '#fff',
  },
  opponentCarContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 25,
    transform: [{ translateY: -12 }],
  },
  playerCarContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 25,
    transform: [{ translateY: -12 }],
  },
  progressMarkers: {
    flexDirection: 'row',
    marginTop: 12,
    height: 20,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    transform: [{ translateX: -6 }],
    alignItems: 'center',
  },
  markerActive: {},
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.trackBorder,
  },
  markerDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
});
