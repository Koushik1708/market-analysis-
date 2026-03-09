import React from 'react';
import * as d3 from 'd3';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  data: Record<number, Record<number, number>>;
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MonthlyHeatmap: React.FC<Props> = ({ data }) => {
  const years = Object.keys(data).map(Number).sort((a, b) => b - a);
  
  // Color scale: Red for negative, Green for positive
  const colorScale = d3.scaleLinear<string>()
    .domain([-10, 0, 10])
    .range(['#ef4444', '#f8fafc', '#22c55e']);

  return (
    <div className="w-full bg-white p-6 rounded-xl shadow-sm border border-black/5 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-6 text-zinc-900">Monthly Returns (%) Heatmap</h3>
      
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-2 mb-2">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Year</div>
          {monthNames.map(m => (
            <div key={m} className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">{m}</div>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {years.map(year => (
            <div key={year} className="grid grid-cols-[80px_repeat(12,1fr)] gap-2 items-center">
              <div className="text-sm font-semibold text-zinc-600">{year}</div>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                const value = data[year]?.[month];
                const hasValue = value !== undefined;
                
                return (
                  <div
                    key={month}
                    className={cn(
                      "h-12 rounded-md flex items-center justify-center text-xs font-medium transition-all hover:scale-105 cursor-default",
                      !hasValue && "bg-zinc-50 text-zinc-300"
                    )}
                    style={{
                      backgroundColor: hasValue ? colorScale(value) : undefined,
                      color: hasValue ? (Math.abs(value) > 5 ? '#fff' : '#1e293b') : undefined
                    }}
                    title={hasValue ? `${value.toFixed(2)}%` : 'No data'}
                  >
                    {hasValue ? `${value.toFixed(1)}%` : '-'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#ef4444]" />
          <span>Negative Return</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#f8fafc] border border-zinc-200" />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#22c55e]" />
          <span>Positive Return</span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyHeatmap;
