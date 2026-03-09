import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Props {
  data: { month: number; average: number }[];
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const SeasonalChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl shadow-sm border border-black/5">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900">Average Monthly Closing Price</h3>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="month" 
            tickFormatter={(tick) => monthNames[tick - 1]}
            stroke="#888"
            fontSize={12}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#888"
            fontSize={12}
            tickFormatter={(val) => `₹${val.toFixed(0)}`}
          />
          <Tooltip 
            labelFormatter={(label) => monthNames[label - 1]}
            formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Avg Close']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Bar dataKey="average" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.average > 0 ? '#0ea5e9' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SeasonalChart;
