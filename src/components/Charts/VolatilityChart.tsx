import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AnalysisDataPoint } from '../../types';
import { format } from 'date-fns';

interface Props {
  data: AnalysisDataPoint[];
}

const VolatilityChart: React.FC<Props> = ({ data }) => {
  const filteredData = data.filter(d => d.volatility !== null);

  return (
    <div className="w-full h-[300px] md:h-[400px] bg-white p-4 rounded-xl shadow-sm border border-black/5">
      <h3 className="text-base md:text-lg font-semibold mb-4 text-zinc-900">20-Day Rolling Volatility (Annualized)</h3>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(tick) => format(new Date(tick), 'MMM yyyy')}
            minTickGap={50}
            stroke="#888"
            fontSize={12}
          />
          <YAxis 
            stroke="#888"
            fontSize={12}
            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
          />
          <Tooltip 
            labelFormatter={(label) => format(new Date(label), 'PPP')}
            formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Volatility']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Line 
            type="monotone" 
            dataKey="volatility" 
            stroke="#f97316" 
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolatilityChart;
