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

const MovingAverageChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border border-black/5">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900">Moving Averages (50 & 200 Day)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
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
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#3b82f6" 
            strokeOpacity={0.3}
            dot={false}
            strokeWidth={1}
            name="Close"
          />
          <Line 
            type="monotone" 
            dataKey="ma50" 
            stroke="#22c55e" 
            dot={false}
            strokeWidth={2}
            name="50-day MA"
          />
          <Line 
            type="monotone" 
            dataKey="ma200" 
            stroke="#ef4444" 
            dot={false}
            strokeWidth={2}
            name="200-day MA"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MovingAverageChart;
