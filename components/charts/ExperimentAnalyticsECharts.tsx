'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { ExperimentAnalytics } from '@/types';

interface ExperimentAnalyticsEChartsProps {
  analytics: ExperimentAnalytics;
}

export default function ExperimentAnalyticsECharts({ analytics }: ExperimentAnalyticsEChartsProps) {
  const successChartRef = useRef<HTMLDivElement>(null);
  const durationChartRef = useRef<HTMLDivElement>(null);

  // Success Chart
  useEffect(() => {
    if (!successChartRef.current) return;
    const chart = echarts.init(successChartRef.current, undefined, { renderer: 'svg' });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 20, bottom: 25, left: 45 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong><br/>Success Rate: <strong>${item.value}%</strong>`;
        },
      },
      xAxis: {
        type: 'category',
        data: ['Control (S_A: Severity)', 'Treatment (S_B: Spatial)'],
        axisLabel: { color: '#64748B', fontSize: 11, fontWeight: 500 },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          color: '#64748B',
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      },
      series: [
        {
          type: 'bar',
          barWidth: '38%',
          data: [
            {
              value: analytics.control_success_rate,
              itemStyle: {
                color: '#D97706',
                borderRadius: [4, 4, 0, 0],
              },
            },
            {
              value: analytics.treatment_success_rate,
              itemStyle: {
                color: '#0284C7',
                borderRadius: [4, 4, 0, 0],
              },
            },
          ],
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 11,
            fontWeight: 'bold',
            color: '#0F172A',
          },
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [analytics]);

  // Duration Chart
  useEffect(() => {
    if (!durationChartRef.current) return;
    const chart = echarts.init(durationChartRef.current, undefined, { renderer: 'svg' });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 20, bottom: 25, left: 45 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong><br/>Decision Time: <strong>${item.value}s</strong>`;
        },
      },
      xAxis: {
        type: 'category',
        data: ['Control (S_A: Severity)', 'Treatment (S_B: Spatial)'],
        axisLabel: { color: '#64748B', fontSize: 11, fontWeight: 500 },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        max: 120,
        axisLabel: {
          formatter: '{value}s',
          color: '#64748B',
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      },
      series: [
        {
          type: 'bar',
          barWidth: '38%',
          data: [
            {
              value: analytics.control_avg_duration,
              itemStyle: {
                color: '#D97706',
                borderRadius: [4, 4, 0, 0],
              },
            },
            {
              value: analytics.treatment_avg_duration,
              itemStyle: {
                color: '#0284C7',
                borderRadius: [4, 4, 0, 0],
              },
            },
          ],
          label: {
            show: true,
            position: 'top',
            formatter: '{c}s',
            fontSize: 11,
            fontWeight: 'bold',
            color: '#0F172A',
          },
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [analytics]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Primary Success Lift */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-900">
            Primary Metric: Task Success Rate (<code className="font-mono text-sky-700">priority_task_success</code>)
          </div>
          <span className="text-[10px] font-mono text-slate-400">Target ≥ 2 of top 3</span>
        </div>
        <div ref={successChartRef} className="h-48 w-full select-none" />
      </div>

      {/* Decision Latency */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-900">
            Secondary Metric: Average Decision Latency (<code className="font-mono text-sky-700">priority_task_duration_seconds</code>)
          </div>
          <span className="text-[10px] font-mono text-slate-400">120s Timeout Limit</span>
        </div>
        <div ref={durationChartRef} className="h-48 w-full select-none" />
      </div>
    </div>
  );
}
