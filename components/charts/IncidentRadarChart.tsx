'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { IncidentWithContext } from '@/types';

interface IncidentRadarChartProps {
  incident: IncidentWithContext | null;
  height?: number;
}

export default function IncidentRadarChart({
  incident,
  height = 160,
}: IncidentRadarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'svg',
      });
    }

    const chart = chartInstance.current;

    if (!incident) {
      chart.clear();
      return;
    }

    const P = Math.min(100, Math.round(incident.context.population_index * 100));
    const F = Math.min(100, Math.round(incident.context.facility_index * 100));
    const A = Math.min(100, Math.round(incident.context.accessibility_index * 100));
    const S = Math.min(100, Math.round(incident.severity_score));
    const D = Math.min(100, Math.round((incident.duration_hours / 24) * 100));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        textStyle: { fontSize: 11, fontFamily: 'monospace' },
        formatter: (params: any) => {
          return `
            <strong>#${incident.id} Risk Profile</strong><br/>
            • SCADA Severity: ${S}/100<br/>
            • Population Exposure: ${P}/100<br/>
            • Facility Vulnerability: ${F}/100<br/>
            • Isolation / Road Access: ${A}/100<br/>
            • Disruption Duration: ${D}/100
          `;
        },
      },
      radar: {
        indicator: [
          { name: 'Severity', max: 100 },
          { name: 'Pop. Exp.', max: 100 },
          { name: 'Facilities', max: 100 },
          { name: 'Isolation', max: 100 },
          { name: 'Duration', max: 100 },
        ],
        center: ['50%', '52%'],
        radius: '68%',
        splitNumber: 3,
        shape: 'polygon',
        axisName: {
          color: '#94A3B8',
          fontSize: 9,
          fontWeight: 600,
          fontFamily: 'monospace',
        },
        splitLine: {
          lineStyle: {
            color: '#334155',
            width: 1,
            type: 'dashed',
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(30, 41, 59, 0.4)', 'rgba(15, 23, 42, 0.6)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: '#475569',
          },
        },
      },
      series: [
        {
          name: 'Incident Risk Vector',
          type: 'radar',
          data: [
            {
              value: [S, P, F, A, D],
              name: `Incident #${incident.id}`,
              symbol: 'circle',
              symbolSize: 4,
              itemStyle: {
                color: '#38BDF8',
              },
              lineStyle: {
                width: 2,
                color: '#38BDF8',
              },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(56, 189, 248, 0.5)' },
                  { offset: 1, color: 'rgba(2, 132, 199, 0.15)' },
                ]),
              },
            },
          ],
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [incident]);

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: `${height}px` }}
      className="select-none"
    />
  );
}
