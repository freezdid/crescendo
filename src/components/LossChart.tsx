"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function LossChart({ data }: { data: { epoch: number; loss: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="epoch" stroke="#475569" fontSize={10} />
        <YAxis stroke="#475569" fontSize={10} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '11px' }}
        />
        <Line
          type="monotone"
          dataKey="loss"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
