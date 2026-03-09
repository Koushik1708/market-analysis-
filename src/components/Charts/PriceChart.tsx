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
  AreaChart,
  Area,
} from 'recharts';
import { AnalysisDataPoint } from '../../types';
import { format } from 'date-fns';

interface Props {
  data: AnalysisDataPoint[];
}

const PriceChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border border-black/5">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900">Sun Pharma - Close Price (5 Years)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(tick) => format(new Date(tick), 'MMM yyyy')}
            minTickGap={50}
            stroke="#888"
            fontSize={12}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#888"
            fontSize={12}
            tickFormatter={(val) => `₹${val}`}
          />
          <Tooltip 
            labelFormatter={(label) => format(new Date(label), 'PPP')}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Close']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorClose)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceChart;
