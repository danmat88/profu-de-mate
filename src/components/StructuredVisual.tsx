import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type {
  GeometryVisual,
  GraphVisual,
  NumberLineVisual,
  TableVisual,
  VisualColor,
  VisualContentBlock,
} from '../types';
import { colors, fonts } from '../theme';
import { Text } from './Typography';
import { MathFormula } from './MathFormula';

type Props = {
  block: VisualContentBlock;
  containerWidth?: number;
};

const visualColors: Record<VisualColor, string> = {
  violet: colors.violet,
  cyan: colors.cyan,
  lime: '#A9CF1F',
  peach: colors.peach,
  rose: colors.rose,
};

const visualLabels: Record<VisualContentBlock['visual']['kind'], string> = {
  geometry: 'DESEN GEOMETRIC',
  graph: 'GRAFIC',
  table: 'TABEL',
  number_line: 'AXĂ NUMERICĂ',
};

function finiteTicks(minimum: number, maximum: number, requestedStep: number, limit = 12) {
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(requestedStep) || requestedStep <= 0) return [];
  const multiplier = Math.max(1, Math.ceil(range / requestedStep / limit));
  const step = requestedStep * multiplier;
  const first = Math.ceil(minimum / step) * step;
  const values: number[] = [];
  for (let value = first; value <= maximum + step * 0.001 && values.length <= limit; value += step) {
    values.push(Math.abs(value) < step * 0.0001 ? 0 : Number(value.toFixed(8)));
  }
  return values;
}

function compactNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace('.', ',');
}

function GeometryCanvas({ visual }: { visual: GeometryVisual }) {
  const width = 320;
  const height = 220;
  const padding = 28;
  const pointMap = useMemo(() => new Map(visual.points.map((point) => [point.id, {
    ...point,
    px: padding + point.x / 100 * (width - padding * 2),
    py: padding + point.y / 100 * (height - padding * 2),
  }])), [visual.points]);

  return (
    <Svg accessible={false} viewBox={`0 0 ${width} ${height}`} width="100%" height={220}>
      <Rect x="0" y="0" width={width} height={height} rx="16" fill="#FCFAFF" />
      {visual.polygons.map((polygon, index) => {
        const points = polygon.points.map((id) => pointMap.get(id)).filter(Boolean).map((point) => `${point!.px},${point!.py}`).join(' ');
        return <Polygon key={`polygon-${index}`} points={points} fill={visualColors[polygon.color]} fillOpacity={0.14} stroke={visualColors[polygon.color]} strokeWidth={1.5} />;
      })}
      {visual.circles.map((circle, index) => {
        const center = pointMap.get(circle.center);
        if (!center) return null;
        return <Circle key={`circle-${index}`} cx={center.px} cy={center.py} r={circle.radius / 100 * (width - padding * 2)} fill="none" stroke={visualColors[circle.color]} strokeWidth={2.5} />;
      })}
      {visual.segments.map((segment, index) => {
        const from = pointMap.get(segment.from);
        const to = pointMap.get(segment.to);
        if (!from || !to) return null;
        return <Line key={`segment-${index}`} x1={from.px} y1={from.py} x2={to.px} y2={to.py} stroke={visualColors[segment.color]} strokeWidth={3} strokeDasharray={segment.style === 'dashed' ? '8 6' : undefined} strokeLinecap="round" />;
      })}
      {visual.points.map((point) => {
        const resolved = pointMap.get(point.id)!;
        return (
          <G key={point.id}>
            <Circle cx={resolved.px} cy={resolved.py} r={5} fill={colors.paper} stroke={colors.ink} strokeWidth={2.5} />
            {point.label ? <SvgText x={resolved.px + 8} y={resolved.py - 8} fill={colors.ink} fontFamily={fonts.bodyBold} fontSize={13}>{point.label}</SvgText> : null}
          </G>
        );
      })}
    </Svg>
  );
}

function GraphCanvas({ visual }: { visual: GraphVisual }) {
  const width = 320;
  const height = 230;
  const plot = { left: 38, right: 14, top: 15, bottom: 32 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const mapX = (value: number) => plot.left + (value - visual.xMin) / (visual.xMax - visual.xMin) * plotWidth;
  const mapY = (value: number) => plot.top + (visual.yMax - value) / (visual.yMax - visual.yMin) * plotHeight;
  const xTicks = finiteTicks(visual.xMin, visual.xMax, visual.xStep);
  const yTicks = finiteTicks(visual.yMin, visual.yMax, visual.yStep);
  const axisX = visual.yMin <= 0 && visual.yMax >= 0 ? mapY(0) : height - plot.bottom;
  const axisY = visual.xMin <= 0 && visual.xMax >= 0 ? mapX(0) : plot.left;

  return (
    <Svg accessible={false} viewBox={`0 0 ${width} ${height}`} width="100%" height={230}>
      <Rect x="0" y="0" width={width} height={height} rx="16" fill="#FCFAFF" />
      {xTicks.map((tick) => <Line key={`x-grid-${tick}`} x1={mapX(tick)} y1={plot.top} x2={mapX(tick)} y2={height - plot.bottom} stroke="#E1DAEE" strokeWidth={1} />)}
      {yTicks.map((tick) => <Line key={`y-grid-${tick}`} x1={plot.left} y1={mapY(tick)} x2={width - plot.right} y2={mapY(tick)} stroke="#E1DAEE" strokeWidth={1} />)}
      <Line x1={plot.left} y1={axisX} x2={width - plot.right} y2={axisX} stroke={colors.ink} strokeWidth={2} />
      <Line x1={axisY} y1={plot.top} x2={axisY} y2={height - plot.bottom} stroke={colors.ink} strokeWidth={2} />
      {xTicks.map((tick) => <SvgText key={`x-label-${tick}`} x={mapX(tick)} y={height - 10} textAnchor="middle" fill={colors.inkSoft} fontFamily={fonts.bodyMedium} fontSize={11}>{compactNumber(tick)}</SvgText>)}
      {yTicks.filter((tick) => tick !== 0).map((tick) => <SvgText key={`y-label-${tick}`} x={plot.left - 7} y={mapY(tick) + 4} textAnchor="end" fill={colors.inkSoft} fontFamily={fonts.bodyMedium} fontSize={11}>{compactNumber(tick)}</SvgText>)}
      {visual.series.map((series, index) => (
        <Polyline
          key={`series-${index}`}
          points={series.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ')}
          fill="none"
          stroke={visualColors[series.color]}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <SvgText x={width - plot.right} y={axisX - 7} textAnchor="end" fill={colors.ink} fontFamily={fonts.bodyBold} fontSize={12}>x</SvgText>
      <SvgText x={axisY + 7} y={plot.top + 11} fill={colors.ink} fontFamily={fonts.bodyBold} fontSize={12}>y</SvgText>
    </Svg>
  );
}

function NumberLineCanvas({ visual }: { visual: NumberLineVisual }) {
  const width = 320;
  const height = 132;
  const left = 22;
  const right = width - 22;
  const axisY = 62;
  const mapX = (value: number) => left + (value - visual.min) / (visual.max - visual.min) * (right - left);
  const ticks = finiteTicks(visual.min, visual.max, visual.step, 14);

  return (
    <Svg accessible={false} viewBox={`0 0 ${width} ${height}`} width="100%" height={132}>
      <Rect x="0" y="0" width={width} height={height} rx="16" fill="#FCFAFF" />
      <Line x1={left} y1={axisY} x2={right} y2={axisY} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
      <Polygon points={`${right},${axisY} ${right - 10},${axisY - 6} ${right - 10},${axisY + 6}`} fill={colors.ink} />
      {visual.intervals.map((interval, index) => {
        const color = visualColors[interval.color];
        return (
          <G key={`interval-${index}`}>
            <Line x1={mapX(interval.start)} y1={axisY - 16} x2={mapX(interval.end)} y2={axisY - 16} stroke={color} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={mapX(interval.start)} cy={axisY - 16} r={5.5} fill={interval.startClosed ? color : colors.paper} stroke={color} strokeWidth={2.5} />
            <Circle cx={mapX(interval.end)} cy={axisY - 16} r={5.5} fill={interval.endClosed ? color : colors.paper} stroke={color} strokeWidth={2.5} />
          </G>
        );
      })}
      {ticks.map((tick) => (
        <G key={`tick-${tick}`}>
          <Line x1={mapX(tick)} y1={axisY - 6} x2={mapX(tick)} y2={axisY + 7} stroke={colors.ink} strokeWidth={1.5} />
          <SvgText x={mapX(tick)} y={axisY + 25} textAnchor="middle" fill={colors.inkSoft} fontFamily={fonts.bodyMedium} fontSize={11}>{compactNumber(tick)}</SvgText>
        </G>
      ))}
      {visual.markers.map((marker, index) => {
        const color = visualColors[marker.color];
        return (
          <G key={`marker-${index}`}>
            <Circle cx={mapX(marker.value)} cy={axisY} r={6.5} fill={marker.closed ? color : colors.paper} stroke={color} strokeWidth={3} />
            <SvgText x={mapX(marker.value)} y={axisY + 47} textAnchor="middle" fill={colors.ink} fontFamily={fonts.bodyBold} fontSize={12}>{marker.label}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function TableCanvas({ visual, containerWidth }: { visual: TableVisual; containerWidth: number }) {
  const cellWidth = Math.max(104, Math.min(142, containerWidth / Math.min(visual.headers.length, 3)));
  const tableWidth = Math.max(containerWidth - 4, cellWidth * visual.headers.length);

  return (
    <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={tableWidth > containerWidth} contentContainerStyle={{ minWidth: tableWidth }}>
      <View style={[styles.table, { width: tableWidth }]}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          {visual.headers.map((header, index) => <View key={`header-${index}`} style={[styles.tableCell, { width: cellWidth }]}><Text style={styles.tableHeaderText}>{header}</Text></View>)}
        </View>
        {visual.rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={[styles.tableRow, rowIndex % 2 === 1 && styles.tableRowAlternate]}>
            {row.cells.map((cell, cellIndex) => (
              <View key={`cell-${rowIndex}-${cellIndex}`} style={[styles.tableCell, { width: cellWidth }]}>
                {'rendered' in cell ? (
                  <MathFormula math={{ type: 'math', text: '', latex: cell.latex, spoken: cell.spoken, rendered: cell.rendered }} color={colors.ink} fontSize={14} minHeight={30} containerWidth={cellWidth - 14} />
                ) : <Text style={styles.tableCellText}>{cell.text}</Text>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function StructuredVisual({ block, containerWidth }: Props) {
  const window = useWindowDimensions();
  const resolvedWidth = Math.max(220, containerWidth ?? window.width - 76);
  const visual = block.visual;

  return (
    <View style={styles.card}>
      <View accessible accessibilityRole="image" accessibilityLabel={block.spoken} style={styles.header}>
        <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{visualLabels[visual.kind]}</Text></View>
        <Text style={styles.title}>{visual.title}</Text>
      </View>
      <View style={styles.canvas}>
        {visual.kind === 'geometry' ? <GeometryCanvas visual={visual} /> : null}
        {visual.kind === 'graph' ? <GraphCanvas visual={visual} /> : null}
        {visual.kind === 'number_line' ? <NumberLineCanvas visual={visual} /> : null}
        {visual.kind === 'table' ? <TableCanvas visual={visual} containerWidth={resolvedWidth - 20} /> : null}
      </View>
      {visual.kind === 'table' && visual.headers.length > 3 ? <Text style={styles.scrollHint}>↔ Glisează pentru a vedea tot tabelul</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, padding: 9, overflow: 'hidden' },
  header: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingBottom: 8 },
  typeBadge: { minHeight: 30, justifyContent: 'center', borderRadius: 9, backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 8, transform: [{ rotate: '-2deg' }] },
  typeBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12, letterSpacing: 0.7 },
  title: { flex: 1, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16, lineHeight: 20 },
  canvas: { width: '100%', borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FCFAFF', overflow: 'hidden' },
  scrollHint: { marginTop: 7, fontFamily: fonts.bodyMedium, color: colors.violetDeep, fontSize: 12, textAlign: 'right' },
  table: { borderRadius: 14, overflow: 'hidden' },
  tableRow: { minHeight: 50, flexDirection: 'row', backgroundColor: colors.paper },
  tableRowAlternate: { backgroundColor: '#F8F4FF' },
  tableHeader: { backgroundColor: colors.violetSoft },
  tableCell: { minHeight: 50, justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 7, paddingVertical: 6 },
  tableHeaderText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  tableCellText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
