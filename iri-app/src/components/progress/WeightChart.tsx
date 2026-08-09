import { useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { WeightEntry } from '@/features/progress/weights';
import { t } from '@/i18n';
import { colors, font } from '@/theme';

export interface WeightChartProps {
  readonly entries: readonly WeightEntry[];
  readonly targetKg: number | null;
  readonly height?: number;
}

const PAD_LEFT = 8;
const PAD_RIGHT = 44;
const PAD_TOP = 22;
const PAD_BOTTOM = 10;

/**
 * Gewichtskurve: eine Serie im Rosé-Akzent, ruhiges Grid, Zielgewicht als
 * gestrichelte neutrale Referenzlinie, Label nur am letzten Punkt.
 */
export function WeightChart({ entries, targetKg, height = 180 }: WeightChartProps) {
  const [width, setWidth] = useState(0);

  if (entries.length === 0) return null;

  const values = entries.map((e) => e.weight_kg);
  const times = entries.map((e) => new Date(e.measured_on).getTime());
  // Skala NUR aus den Messwerten (Beta-Befund 09.08.): Ein fernes Ziel (z. B.
  // 68 bei Werten um 80) drueckte die Kurve sonst flach an den oberen Rand.
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) {
    // flache Kurven nicht dramatisieren — mindestens 2 kg Spannweite
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  const domainPad = (max - min) * 0.12;
  min -= domainPad;
  max += domainPad;

  const t0 = Math.min(...times);
  const t1 = Math.max(...times, t0 + 1);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const x = (time: number) =>
    PAD_LEFT + (entries.length === 1 ? plotW / 2 : ((time - t0) / (t1 - t0)) * plotW);
  const y = (kg: number) => PAD_TOP + (1 - (kg - min) / (max - min)) * plotH;

  const linePath = entries
    .map((e, i) => `${i === 0 ? 'M' : 'L'}${x(new Date(e.measured_on).getTime()).toFixed(1)},${y(e.weight_kg).toFixed(1)}`)
    .join(' ');
  const areaPath =
    entries.length > 1
      ? `${linePath} L${x(t1).toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} L${x(t0).toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} Z`
      : null;

  const latest = entries[entries.length - 1];
  const latestX = x(new Date(latest.measured_on).getTime());
  const latestY = y(latest.weight_kg);

  const gridValues = [min + (max - min) * 0.15, (min + max) / 2, min + (max - min) * 0.85].map(
    (v) => Math.round(v * 10) / 10,
  );

  const formatKg = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 });

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.tint} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={colors.tint} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridValues.map((v) => (
            <Line
              key={v}
              x1={PAD_LEFT}
              x2={PAD_LEFT + plotW}
              y1={y(v)}
              y2={y(v)}
              stroke={colors.track}
              strokeWidth={1}
            />
          ))}
          {gridValues.map((v) => (
            <SvgText
              key={`label-${v}`}
              x={width - PAD_RIGHT + 6}
              y={y(v) + 3.5}
              fontSize={10}
              fontFamily={font.semibold}
              fill={colors.muted}
            >
              {formatKg(v)}
            </SvgText>
          ))}

          {targetKg != null && targetKg >= min && targetKg <= max ? (
            <>
              <Line
                x1={PAD_LEFT}
                x2={PAD_LEFT + plotW}
                y1={y(targetKg)}
                y2={y(targetKg)}
                stroke={colors.muted2}
                strokeWidth={1.5}
                strokeDasharray="5,4"
              />
              <SvgText
                x={PAD_LEFT + 2}
                y={y(targetKg) - 5}
                fontSize={10}
                fontFamily={font.bold}
                fill={colors.muted}
              >
                {t('progress.targetLabel', { kg: formatKg(targetKg) })}
              </SvgText>
            </>
          ) : null}

          {areaPath ? <Path d={areaPath} fill="url(#weightFill)" /> : null}
          <Path d={linePath} stroke={colors.tintDeep} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          <Circle cx={latestX} cy={latestY} r={4.5} fill={colors.tintDeep} stroke="#fff" strokeWidth={2} />
          <SvgText
            x={Math.min(latestX, width - PAD_RIGHT - 6)}
            y={latestY - 10}
            fontSize={12}
            fontFamily={font.bold}
            fill={colors.ink}
            textAnchor="middle"
          >
            {formatKg(latest.weight_kg)}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
