import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { colors, fonts, radii } from '../../../shared/theme';
import type {
  GeometryVisual,
  GraphVisual,
  NumberLineVisual,
  StructuredVisual,
  TableVisual,
  VisualColor,
} from '../../../shared/types';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import { StudyInlineText } from './StudyInlineText';

type Props = {
  visual: StructuredVisual;
  spoken?: string;
  scale?: number;
};

const PALETTE: Record<VisualColor, string> = {
  violet: '#7C3CFF',
  cyan: '#17A6B8',
  lime: '#78A300',
  peach: '#F06A43',
  rose: '#E33E5A',
};

const VISUAL_BADGE: Record<StructuredVisual['kind'], string> = {
  geometry: 'FIGURĂ GEOMETRICĂ',
  graph: 'GRAFIC DE FUNCȚIE',
  table: 'TABEL DE REFERINȚĂ',
  number_line: 'AXĂ NUMERICĂ',
};

function compactNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace('.', ',');
}

function finiteTicks(min: number, max: number, requestedStep: number, limit = 10): number[] {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(requestedStep) || requestedStep <= 0) {
    return [];
  }
  const multiplier = Math.max(1, Math.ceil(range / requestedStep / limit));
  const step = requestedStep * multiplier;
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let v = first; v <= max + step * 0.001 && values.length <= limit; v += step) {
    values.push(Math.abs(v) < step * 0.0001 ? 0 : Number(v.toFixed(8)));
  }
  return values;
}

function NativeGeometryDiagram({ visual }: { visual: GeometryVisual }) {
  const W = 320;
  const H = 200;
  const padX = 28;
  const padY = 22;
  const mapX = (x: number) => padX + (x / 100) * (W - padX * 2);
  const mapY = (y: number) => padY + (y / 100) * (H - padY * 2);
  const pointById = new Map(visual.points.map((p) => [p.id, p]));

  return (
    <View style={styles.svgStage}>
      <Svg width="100%" height={192} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill="#FBF9FF" />

        {visual.polygons.map((poly, idx) => {
          const pts = poly.points
            .map((id) => pointById.get(id))
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .map((p) => `${mapX(p.x)},${mapY(p.y)}`)
            .join(' ');
          if (!pts) return null;
          return (
            <Polygon
              key={`poly-${idx}`}
              points={pts}
              fill={PALETTE[poly.color]}
              fillOpacity={0.11}
            />
          );
        })}

        {visual.circles.map((circle, idx) => {
          const center = pointById.get(circle.center);
          if (!center) return null;
          const r = (circle.radius / 100) * Math.min(W - padX * 2, H - padY * 2);
          return (
            <Circle
              key={`circ-${idx}`}
              cx={mapX(center.x)}
              cy={mapY(center.y)}
              r={r}
              fill={PALETTE[circle.color]}
              fillOpacity={0.07}
              stroke={PALETTE[circle.color]}
              strokeWidth={2.2}
            />
          );
        })}

        {visual.segments.map((seg, idx) => {
          const from = pointById.get(seg.from);
          const to = pointById.get(seg.to);
          if (!from || !to) return null;
          return (
            <Line
              key={`seg-${idx}`}
              x1={mapX(from.x)}
              y1={mapY(from.y)}
              x2={mapX(to.x)}
              y2={mapY(to.y)}
              stroke={PALETTE[seg.color]}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray={seg.style === 'dashed' ? '6,5' : undefined}
            />
          );
        })}

        {visual.points.map((pt) => {
          const cx = mapX(pt.x);
          const cy = mapY(pt.y);
          const labelOffsetY = pt.y < 50 ? -12 : 18;
          return (
            <G key={pt.id}>
              <Circle cx={cx} cy={cy} r={4.2} fill={colors.paper} stroke={colors.ink} strokeWidth={2.2} />
              <SvgText
                x={cx}
                y={cy + labelOffsetY}
                fill={colors.ink}
                fontSize={14}
                fontWeight="700"
                fontFamily={fonts.bodyBold}
                textAnchor="middle"
              >
                {pt.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function NativeGraphDiagram({ visual }: { visual: GraphVisual }) {
  const W = 320;
  const H = 208;
  const padL = 34;
  const padR = 18;
  const padT = 18;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const mapX = (x: number) => padL + ((x - visual.xMin) / (visual.xMax - visual.xMin)) * plotW;
  const mapY = (y: number) => padT + ((visual.yMax - y) / (visual.yMax - visual.yMin)) * plotH;

  const xTicks = finiteTicks(visual.xMin, visual.xMax, visual.xStep, 8);
  const yTicks = finiteTicks(visual.yMin, visual.yMax, visual.yStep, 8);
  const axisX = Math.max(padL, Math.min(W - padR, mapX(0)));
  const axisY = Math.max(padT, Math.min(H - padB, mapY(0)));

  return (
    <View style={styles.svgStage}>
      <Svg width="100%" height={200} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill="#FBF9FF" />

        {xTicks.map((t) => {
          const x = mapX(t);
          return (
            <G key={`gx-${t}`}>
              <Line x1={x} y1={padT} x2={x} y2={H - padB} stroke="#EAE3FA" strokeWidth={1} />
              {t !== 0 ? (
                <SvgText
                  x={x}
                  y={H - 10}
                  fill={colors.inkMuted}
                  fontSize={10.5}
                  fontFamily={fonts.bodyMedium}
                  textAnchor="middle"
                >
                  {compactNumber(t)}
                </SvgText>
              ) : null}
            </G>
          );
        })}

        {yTicks.map((t) => {
          const y = mapY(t);
          return (
            <G key={`gy-${t}`}>
              <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#EAE3FA" strokeWidth={1} />
              {t !== 0 ? (
                <SvgText
                  x={padL - 8}
                  y={y + 3.5}
                  fill={colors.inkMuted}
                  fontSize={10.5}
                  fontFamily={fonts.bodyMedium}
                  textAnchor="end"
                >
                  {compactNumber(t)}
                </SvgText>
              ) : null}
            </G>
          );
        })}

        {/* Axes */}
        <Line x1={padL} y1={axisY} x2={W - padR} y2={axisY} stroke="#7A6B99" strokeWidth={1.6} />
        <Line x1={axisX} y1={padT} x2={axisX} y2={H - padB} stroke="#7A6B99" strokeWidth={1.6} />
        <SvgText x={W - padR + 2} y={axisY + 4} fill="#5C4D7A" fontSize={11} fontWeight="700">x</SvgText>
        <SvgText x={axisX + 6} y={padT + 8} fill="#5C4D7A" fontSize={11} fontWeight="700">y</SvgText>

        {visual.series.map((series, idx) => {
          const pointsStr = series.points
            .map((pt) => `${mapX(pt.x).toFixed(1)},${mapY(pt.y).toFixed(1)}`)
            .join(' ');
          const stroke = PALETTE[series.color];
          return (
            <G key={`ser-${idx}`}>
              <Polyline
                points={pointsStr}
                fill="none"
                stroke={stroke}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {series.points.filter((_, i) => i === Math.floor(series.points.length / 2)).map((pt, pIdx) => (
                <Circle
                  key={`vtx-${pIdx}`}
                  cx={mapX(pt.x)}
                  cy={mapY(pt.y)}
                  r={4.6}
                  fill={colors.lime}
                  stroke={colors.ink}
                  strokeWidth={2}
                />
              ))}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function NativeNumberLineDiagram({ visual }: { visual: NumberLineVisual }) {
  const W = 320;
  const H = 84;
  const padX = 24;
  const lineY = 44;
  const mapX = (v: number) => padX + ((v - visual.min) / (visual.max - visual.min)) * (W - padX * 2);
  const ticks = finiteTicks(visual.min, visual.max, visual.step, 9);

  return (
    <View style={styles.svgStage}>
      <Svg width="100%" height={84} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill="#FBF9FF" />
        <Line x1={padX - 8} y1={lineY} x2={W - padX + 8} y2={lineY} stroke={colors.ink} strokeWidth={2} />
        {ticks.map((t) => {
          const x = mapX(t);
          return (
            <G key={`nl-${t}`}>
              <Line x1={x} y1={lineY - 5} x2={x} y2={lineY + 5} stroke={colors.inkSoft} strokeWidth={1.5} />
              <SvgText x={x} y={lineY + 20} fill={colors.inkSoft} fontSize={11} textAnchor="middle">
                {compactNumber(t)}
              </SvgText>
            </G>
          );
        })}
        {visual.intervals.map((interval, idx) => {
          const x1 = mapX(interval.start);
          const x2 = mapX(interval.end);
          const col = PALETTE[interval.color];
          return (
            <G key={`int-${idx}`}>
              <Line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke={col} strokeWidth={5} strokeLinecap="round" />
              <Circle cx={x1} cy={lineY} r={4.5} fill={interval.startClosed ? col : colors.paper} stroke={col} strokeWidth={2} />
              <Circle cx={x2} cy={lineY} r={4.5} fill={interval.endClosed ? col : colors.paper} stroke={col} strokeWidth={2} />
            </G>
          );
        })}
        {visual.markers.map((marker, idx) => {
          const x = mapX(marker.value);
          const col = PALETTE[marker.color];
          return (
            <G key={`mk-${idx}`}>
              <Circle cx={x} cy={lineY} r={5} fill={marker.closed ? col : colors.paper} stroke={col} strokeWidth={2} />
              {marker.label ? (
                <SvgText
                  x={x}
                  y={lineY - 12}
                  fill={col}
                  fontSize={11}
                  fontFamily={fonts.bodyBold}
                  textAnchor="middle"
                >
                  {marker.label}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function NativeTableDiagram({ visual, scale = 1 }: { visual: TableVisual; scale?: number }) {
  const [scrollState, setScrollState] = useState({ x: 0, viewportWidth: 0, contentWidth: 0 });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextW = Math.round(event.nativeEvent.layout.width);
    if (nextW > 0) setScrollState((prev) => (Math.abs(prev.viewportWidth - nextW) < 2 ? prev : { ...prev, viewportWidth: nextW }));
  }, []);

  const handleContentSize = useCallback((w: number) => {
    const nextW = Math.round(w);
    if (nextW > 0) setScrollState((prev) => (Math.abs(prev.contentWidth - nextW) < 2 ? prev : { ...prev, contentWidth: nextW }));
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextX = Math.max(0, Math.round(event.nativeEvent.contentOffset.x));
    setScrollState((prev) => (Math.abs(prev.x - nextX) < 3 ? prev : { ...prev, x: nextX }));
  }, []);

  const hasOverflow = scrollState.viewportWidth > 0 && scrollState.contentWidth > scrollState.viewportWidth + 6;
  const maxScroll = Math.max(1, scrollState.contentWidth - scrollState.viewportWidth);
  const canScrollRight = hasOverflow && scrollState.x < maxScroll - 6;
  const canScrollLeft = hasOverflow && scrollState.x > 6;

  return (
    <View style={styles.tableOuter}>
      <View style={styles.tableStage} onLayout={handleLayout}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSize}
        >
          <View style={styles.tableBox}>
            <View style={styles.tableHeaderRow}>
              {visual.headers.map((header, idx) => (
                <View key={`th-${idx}`} style={[styles.tableCell, idx === 0 && styles.tableFirstCol]}>
                  <StudyInlineText
                    text={header}
                    scale={scale * 0.92}
                    align="center"
                    color={colors.violetDeep}
                    textStyle={styles.tableHeaderText}
                    maxMathWidth={82}
                  />
                </View>
              ))}
            </View>
            {visual.rows.map((row, rIdx) => (
              <View
                key={`tr-${rIdx}`}
                style={[styles.tableRow, rIdx % 2 === 1 && styles.tableRowAlt]}
              >
                {row.cells.map((cell, cIdx) => {
                  const compiled = 'rendered' in cell && cell.rendered
                    ? cell.rendered
                    : cell.latex
                      ? getRenderedStudyMath(cell.latex, 'inline')
                      : undefined;
                  return (
                    <View key={`td-${rIdx}-${cIdx}`} style={[styles.tableCell, cIdx === 0 && styles.tableFirstCol]}>
                      {compiled ? (
                        <NativeMathFormula
                          rendered={compiled}
                          size="inline"
                          scale={scale * 0.95}
                          color={cIdx === 0 ? colors.violetDeep : colors.ink}
                          maxWidth={82}
                        />
                      ) : (
                        <StudyInlineText
                          text={cell.text || ''}
                          scale={scale * 0.92}
                          align="center"
                          color={cIdx === 0 ? colors.violetDeep : colors.ink}
                          textStyle={cIdx === 0 ? styles.tableFirstColText : styles.tableCellText}
                          maxMathWidth={82}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {canScrollLeft ? (
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF', '#FFFFFF00']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.tableFadeLeft}
          />
        ) : null}
        {canScrollRight ? (
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF00', '#FFFFFF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.tableFadeRight}
          />
        ) : null}
      </View>

      {hasOverflow ? (
        <View pointerEvents="none" style={styles.tableHintRow}>
          <View style={styles.tableHintPill}>
            <Text maxFontSizeMultiplier={1.1} style={styles.tableHintText}>
              {!canScrollRight ? '← Înapoi la început' : 'Glisează tabelul →'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Pure native visual renderer (`react-native-svg` + RN Views) for geometry
 * figures, function graphs, number lines, and reference tables. Zero WebView.
 */
export const NativeMathVisual = memo(function NativeMathVisual({ visual, spoken, scale = 1 }: Props) {
  return (
    <View accessible accessibilityLabel={spoken ?? visual.title} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{VISUAL_BADGE[visual.kind]}</Text>
        <StudyInlineText
          text={visual.title}
          scale={scale * 0.96}
          textStyle={styles.title}
        />
      </View>

      {visual.kind === 'geometry' ? <NativeGeometryDiagram visual={visual} /> : null}
      {visual.kind === 'graph' ? <NativeGraphDiagram visual={visual} /> : null}
      {visual.kind === 'number_line' ? <NativeNumberLineDiagram visual={visual} /> : null}
      {visual.kind === 'table' ? <NativeTableDiagram visual={visual} scale={scale} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5DCF8',
    backgroundColor: colors.paper,
    padding: 12,
    gap: 8,
  },
  header: {
    gap: 2,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: colors.violetDeep,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink,
  },
  svgStage: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EDE6FB',
  },
  tableOuter: {
    gap: 6,
  },
  tableStage: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableFadeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 18,
  },
  tableFadeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 26,
  },
  tableHintRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tableHintPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: '#EFE8FF',
    borderWidth: 1,
    borderColor: '#DACBFA',
  },
  tableHintText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  tableBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5DCF8',
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3EEFF',
    borderBottomWidth: 1,
    borderColor: '#E2D6FA',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#F1EBFC',
    backgroundColor: colors.paper,
  },
  tableRowAlt: {
    backgroundColor: '#FAF8FF',
  },
  tableCell: {
    minWidth: 66,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#F1EBFC',
  },
  tableFirstCol: {
    minWidth: 62,
    backgroundColor: '#F7F3FF',
  },
  tableHeaderText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  tableFirstColText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  tableCellText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
});
