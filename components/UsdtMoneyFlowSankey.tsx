'use client';

import dynamic from 'next/dynamic';
import { formatTomanVolume } from '@/lib/formatters';
import { Language } from '@/lib/types';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface UsdtMoneyFlowSankeyProps {
  buyVolumeToman: number;
  sellVolumeToman: number;
  isDark: boolean;
  lang: Language;
}

export default function UsdtMoneyFlowSankey({
  buyVolumeToman,
  sellVolumeToman,
  isDark,
  lang,
}: UsdtMoneyFlowSankeyProps) {
  const textColor = isDark ? '#E2E8F0' : '#334155';

  const option = {
    animationDuration: 700,
    tooltip: {
      trigger: 'item',
      valueFormatter: (value: string | number) =>
        formatTomanVolume(Number(value), 'hemat', lang),
    },
    series: [
      {
        type: 'sankey',
        orient: 'horizontal',
        nodeAlign: 'justify',
        layoutIterations: 32,
        left: 20,
        right: 20,
        top: 18,
        bottom: 18,
        nodeWidth: 18,
        nodeGap: 36,
        emphasis: { focus: 'adjacency' },
        data: [
          {
            name: 'ورود سرمایه (تومان)',
            depth: 0,
            itemStyle: { color: '#10B981', borderColor: '#34D399', borderWidth: 1 },
          },
          {
            name: 'تتر (USDT)',
            depth: 1,
            itemStyle: { color: '#06B6D4', borderColor: '#22D3EE', borderWidth: 1 },
          },
          {
            name: 'خروج سرمایه (تومان)',
            depth: 2,
            itemStyle: { color: '#F43F5E', borderColor: '#FB7185', borderWidth: 1 },
          },
        ],
        links: [
          {
            source: 'ورود سرمایه (تومان)',
            target: 'تتر (USDT)',
            value: buyVolumeToman,
            lineStyle: { color: 'source', opacity: 0.5, curveness: 0.5 },
          },
          {
            source: 'تتر (USDT)',
            target: 'خروج سرمایه (تومان)',
            value: sellVolumeToman,
            lineStyle: { color: 'source', opacity: 0.5, curveness: 0.5 },
          },
        ],
        label: {
          color: textColor,
          fontFamily: 'inherit',
          fontSize: 11,
          fontWeight: 600,
          distance: 8,
        },
        lineStyle: { curveness: 0.5 },
      },
    ],
  };

  return (
    <section
      aria-label={lang === 'fa' ? 'نمودار جریان سرمایه تتر' : 'USDT money flow Sankey'}
      className={`mt-4 rounded-xl border p-3 sm:p-4 ${
        isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-white'
      }`}
    >
      <h4 className={`mb-2 text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        {lang === 'fa' ? 'نمودار جریان سرمایه تتر' : 'USDT Capital Flow'}
      </h4>
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        style={{ height: 220, width: '100%' }}
      />
    </section>
  );
}
