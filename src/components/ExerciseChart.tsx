import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatDay, t } from '../i18n';
import { columnPath, compact, linear, nearest, niceAxis, smoothPath } from '../lib/chart';
import { readPref, writePref } from '../lib/prefs';
import { formatClock } from '../timer/engine';
import type { ExerciseProgress } from '../types';
import { Card, Segmented, T, color, tap } from '../ui';

type View_ = 'line' | 'bars' | 'table';

const VIEW_KEY = 'nimble.chartView';
const VIEWS: View_[] = ['line', 'bars', 'table'];
const HEIGHT = 176;
const PAD = { top: 12, right: 40, bottom: 28, left: 2 };
const MAX_BAR = 24;

const savedView = (): View_ => {
  const v = readPref(VIEW_KEY);
  return VIEWS.includes(v as View_) ? (v as View_) : 'line';
};

const isClock = (unit: string) => unit === 's';
const axisLabel = (unit: string, v: number) => (isClock(unit) ? formatClock(v) : compact(v));
const valueText = (unit: string, v: number) => (isClock(unit) ? formatClock(v) : `${compact(v)} ${unit}`);

/**
 * One exercise's history as a clean card: the latest value up top, then a line, bars or a table.
 * Touching or dragging across the chart reads out any session.
 */
export function ExerciseChart({ progress }: { progress: ExerciseProgress }) {
  const { exerciseName, unit, points } = progress;
  const [view, setView] = useState<View_>(savedView);
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(300);

  const last = points.length - 1;
  const shown = active ?? last;
  const current = points[shown];
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;

  const geometry = useMemo(() => {
    const values = points.map((p) => p.value);
    const axis = niceAxis(values, { fromZero: view === 'bars' });
    const y = linear([axis.min, axis.max], [baseY, PAD.top]);
    let xs: number[];
    let barW = 0;
    if (view === 'bars') {
      const slot = plotW / points.length;
      barW = Math.max(4, Math.min(MAX_BAR, slot * 0.6));
      xs = points.map((_, i) => PAD.left + slot * i + slot / 2);
    } else {
      // Honest time scale: a long gap between sessions shows as a long gap.
      const times = points.map((p) => Date.parse(`${p.date}T12:00:00`));
      const inset = 8;
      const x = linear([Math.min(...times), Math.max(...times)], [PAD.left + inset, PAD.left + plotW - inset]);
      xs = times.map(x);
    }
    return { axis, y, xs, barW };
  }, [points, view, plotW, baseY]);

  const { axis, y, xs, barW } = geometry;
  const pick = (x: number) => setActive(nearest(xs, x));

  const choose = (id: string) => {
    const next = VIEWS.includes(id as View_) ? (id as View_) : 'line';
    setView(next);
    setActive(null);
    writePref(VIEW_KEY, next);
  };

  const labelAt = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round(last / 2), last];
  const anchorOf = (i: number) => (i === 0 ? 'start' : i === last ? 'end' : 'middle');
  const xLabelX = (i: number) => (i === 0 ? PAD.left : i === last ? PAD.left + plotW : (xs[i] as number));

  const linePts = points.map((p, i) => ({ x: xs[i] as number, y: y(p.value) }));
  const line = smoothPath(linePts);
  const firstPt = linePts[0];
  const lastPt = linePts[last];
  const area = firstPt && lastPt ? `${line}L${lastPt.x},${baseY}L${firstPt.x},${baseY}Z` : '';
  const summary = current ? t('chart.summary', { name: exerciseName, n: points.length, value: valueText(unit, (points[last] as { value: number }).value) }) : exerciseName;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 12 }}>
        <T variant="heading">{exerciseName}</T>
        <Segmented
          options={[
            { id: 'line', label: t('chart.view.line') },
            { id: 'bars', label: t('chart.view.bars') },
            { id: 'table', label: t('chart.view.table') },
          ]}
          value={view}
          onChange={choose}
        />
      </View>

      {current ? (
        <View accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T variant="title">{isClock(unit) ? formatClock(current.value) : compact(current.value)}</T>
            {!isClock(unit) ? (
              <T variant="label" tone="muted">
                {unit}
              </T>
            ) : null}
          </View>
          <T variant="caption" tone="muted">
            {active === null ? `${t('chart.latest')} · ${formatDay(current.date)}` : formatDay(current.date)}
          </T>
        </View>
      ) : null}

      {view === 'table' ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <T variant="caption" tone="muted">
              {t('chart.col.date')}
            </T>
            <T variant="caption" tone="muted">
              {t('chart.col.value')}
            </T>
          </View>
          {[...points].reverse().map((p) => (
            <View key={p.date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: color.line }}>
              <T tone="muted">{formatDay(p.date)}</T>
              <T variant="bodyStrong">{valueText(unit, p.value)}</T>
            </View>
          ))}
        </View>
      ) : (
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width) || 300)}
          onTouchStart={(e) => {
            tap();
            pick(e.nativeEvent.locationX);
          }}
          onTouchMove={(e) => pick(e.nativeEvent.locationX)}
          onTouchEnd={() => setActive(null)}
          onTouchCancel={() => setActive(null)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={summary}
        >
          <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
            {axis.ticks.map((tick) => (
              <G key={tick}>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <SvgText x={width} y={y(tick) + 4} fill={color.muted} fontSize={11} textAnchor="end">
                  {axisLabel(unit, tick)}
                </SvgText>
              </G>
            ))}

            {view === 'line' ? (
              <>
                <Path d={area} fill="rgba(201,247,17,0.1)" />
                <Path d={line} stroke={color.brand} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {active !== null ? <Line x1={xs[shown]} x2={xs[shown]} y1={PAD.top} y2={baseY} stroke="rgba(255,255,255,0.3)" strokeWidth={1} /> : null}
                <Circle cx={xs[shown]} cy={y((current as { value: number }).value)} r={7} fill={color.surfaceCard} />
                <Circle cx={xs[shown]} cy={y((current as { value: number }).value)} r={4.5} fill={color.brand} />
              </>
            ) : (
              points.map((p, i) => <Path key={p.date} d={columnPath((xs[i] as number) - barW / 2, barW, y(p.value), baseY)} fill={i === shown ? color.brand : 'rgba(201,247,17,0.35)'} />)
            )}

            {labelAt.map((i) => (
              <SvgText key={i} x={xLabelX(i)} y={HEIGHT - 6} fill={color.muted} fontSize={11} textAnchor={anchorOf(i)}>
                {formatDay((points[i] as { date: string }).date)}
              </SvgText>
            ))}
          </Svg>
        </View>
      )}
    </Card>
  );
}
