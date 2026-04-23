import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Line,
  G,
  Ellipse,
  RadialGradient,
} from 'react-native-svg';
import { colors } from '../../constants/theme';
import { Car } from './Car';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RaceTrackProps {
  carPosition: number;
  isConcentrated: boolean;
  trackWidth?: number;
  trackHeight?: number;
}

/** Side-view desert sprint: layered dunes, sunset sky, perspective road ribbon. */
export function RaceTrack({
  carPosition,
  isConcentrated,
  trackWidth = SCREEN_WIDTH - 48,
  trackHeight = 268,
}: RaceTrackProps) {
  const W = trackWidth;
  const H = trackHeight;
  const horizonY = H * 0.38;
  const roadTopY = H * 0.62;
  const roadBotY = H - 10;

  const starPositions = React.useMemo(
    () =>
      [0.08, 0.15, 0.22, 0.35, 0.48, 0.55, 0.62, 0.7, 0.82, 0.9].map((x, i) => ({
        x: x * W,
        y: (0.06 + (i % 4) * 0.05) * H,
        r: i % 3 === 0 ? 1.2 : 0.8,
        o: 0.35 + (i % 5) * 0.08,
      })),
    [W, H]
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.scene, { width: W, height: H }]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.sceneSkyTop} />
              <Stop offset="0.45" stopColor={colors.sceneSkyMid} />
              <Stop offset="0.78" stopColor={colors.sceneHorizon} />
              <Stop offset="1" stopColor={colors.sceneGlow} />
            </LinearGradient>
            <LinearGradient id="sunGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#fff7c2" stopOpacity="0.9" />
              <Stop offset="1" stopColor={colors.sceneSun} stopOpacity="0.3" />
            </LinearGradient>
            <LinearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.sceneRoadTop} />
              <Stop offset="1" stopColor={colors.sceneRoad} />
            </LinearGradient>
            <RadialGradient id="vignette" cx="50%" cy="42%" r="78%" fx="50%" fy="38%">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.48" />
            </RadialGradient>
          </Defs>

          <Rect x={0} y={0} width={W} height={H} fill="url(#skyGrad)" />

          {starPositions.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.sceneStar} opacity={s.o} />
          ))}

          <Circle cx={W * 0.78} cy={H * 0.2} r={38} fill="url(#sunGlow)" opacity={0.55} />
          <Circle cx={W * 0.78} cy={H * 0.2} r={22} fill={colors.sceneSun} opacity={0.95} />

          {/* Far dune ridge */}
          <Path
            d={`M0,${horizonY + 8} C ${W * 0.2},${horizonY - 12} ${W * 0.42},${horizonY + 18} ${W * 0.62},${horizonY - 4} S ${W * 0.92},${horizonY + 14} ${W},${horizonY + 6} L ${W},${H * 0.52} L 0,${H * 0.5} Z`}
            fill={colors.sceneDuneFar}
            opacity={0.92}
          />
          {/* Mid dunes */}
          <Path
            d={`M0,${horizonY + 28} C ${W * 0.15},${horizonY + 8} ${W * 0.38},${horizonY + 38} ${W * 0.55},${horizonY + 16} S ${W * 0.88},${horizonY + 42} ${W},${horizonY + 26} L ${W},${H * 0.58} L 0,${H * 0.56} Z`}
            fill={colors.sceneDuneMid}
            opacity={0.95}
          />
          {/* Near dunes (rolling) */}
          <Path
            d={`M0,${horizonY + 48} Q ${W * 0.25},${horizonY + 22} ${W * 0.5},${horizonY + 52} T ${W},${horizonY + 40} L ${W},${roadTopY - 6} L 0,${roadTopY - 10} Z`}
            fill={colors.sceneDuneNear}
          />
          {/* Sand fore-ground */}
          <Path
            d={`M0,${roadTopY - 14} Q ${W * 0.35},${roadTopY - 28} ${W * 0.7},${roadTopY - 16} L ${W},${roadTopY - 8} L ${W},${roadTopY + 4} L 0,${roadTopY + 2} Z`}
            fill={colors.sceneSand}
            opacity={0.88}
          />

          {/* Road: slight perspective (wider at bottom) */}
          <Path
            d={`M ${W * 0.04},${roadTopY} L ${W * 0.96},${roadTopY - 3} L ${W - 8},${roadBotY} L 8,${roadBotY} Z`}
            fill="url(#roadGrad)"
          />
          <Path
            d={`M ${W * 0.04},${roadTopY} L ${W * 0.96},${roadTopY - 3} L ${W - 8},${roadBotY} L 8,${roadBotY} Z`}
            fill="none"
            stroke={colors.sceneRoadEdge}
            strokeWidth={2}
            opacity={0.85}
          />

          {/* Road edge highlights */}
          <Line
            x1={W * 0.04 + 6}
            y1={roadTopY + 8}
            x2={10}
            y2={roadBotY - 6}
            stroke={colors.neonCyan}
            strokeWidth={1}
            opacity={0.35}
          />
          <Line
            x1={W * 0.96 - 6}
            y1={roadTopY + 5}
            x2={W - 10}
            y2={roadBotY - 6}
            stroke={colors.neonMagenta}
            strokeWidth={1}
            opacity={0.3}
          />

          {/* Center dashed line (side-view highway) */}
          {Array.from({ length: 14 }).map((_, i) => {
            const t = i / 13;
            const y = roadTopY + 10 + t * (roadBotY - roadTopY - 24);
            const x1 = W * 0.22 + t * (W * 0.56);
            const len = 10 + t * 8;
            return (
              <Line
                key={i}
                x1={x1}
                y1={y}
                x2={x1 + len}
                y2={y - 1.5}
                stroke={colors.sceneRoadMark}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.55 + t * 0.25}
              />
            );
          })}

          {/* Heat shimmer line at horizon */}
          <Path
            d={`M 0,${horizonY + 2} Q ${W * 0.5},${horizonY - 2} ${W},${horizonY + 1}`}
            stroke={colors.sceneGlow}
            strokeWidth={1.5}
            opacity={0.25}
            fill="none"
          />

          {/* Finish tower / checkered */}
          <G>
            <Rect
              x={W - 26}
              y={roadTopY - 8}
              width={20}
              height={roadBotY - roadTopY + 18}
              rx={3}
              fill={colors.sceneRoad}
              stroke={colors.text}
              strokeWidth={1.5}
              opacity={0.95}
            />
            {Array.from({ length: 5 }).map((_, row) =>
              Array.from({ length: 2 }).map((_, col) => (
                <Rect
                  key={`chk-${row}-${col}`}
                  x={W - 24 + col * 9}
                  y={roadTopY - 4 + row * ((roadBotY - roadTopY + 12) / 5)}
                  width={9}
                  height={(roadBotY - roadTopY + 12) / 5}
                  fill={(row + col) % 2 === 0 ? colors.text : 'transparent'}
                  opacity={0.9}
                />
              ))
            )}
            <Ellipse
              cx={W - 16}
              cy={roadTopY - 18}
              rx={8}
              ry={4}
              fill={colors.neonCyan}
              opacity={isConcentrated ? 0.9 : 0.35}
            />
          </G>

          <Rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />
        </Svg>

        <View style={styles.carLane}>
          <Car
            position={carPosition}
            isConcentrated={isConcentrated}
            color={colors.playerCar}
            size={102}
          />
        </View>
      </View>

      <View style={[styles.markers, { width: W }]}>
        {[0, 25, 50, 75, 100].map((marker) => (
          <View key={marker} style={[styles.marker, { left: `${marker}%` }]}>
            <View
              style={[
                styles.markerCap,
                carPosition >= marker && styles.markerCapOn,
              ]}
            />
            <View style={styles.markerStem} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  scene: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hudGlassBorder,
    backgroundColor: colors.sceneSkyTop,
  },
  carLane: {
    position: 'absolute',
    left: 22,
    right: 34,
    bottom: 26,
    height: 54,
    justifyContent: 'flex-end',
  },
  markers: {
    marginTop: 14,
    height: 28,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    transform: [{ translateX: -8 }],
    alignItems: 'center',
  },
  markerCap: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.hudGlassBorder,
  },
  markerCapOn: {
    backgroundColor: colors.neonCyan,
    borderColor: colors.neonMagenta,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  markerStem: {
    width: 2,
    height: 8,
    marginTop: 2,
    backgroundColor: colors.surfaceLight,
    opacity: 0.5,
    borderRadius: 1,
  },
});
