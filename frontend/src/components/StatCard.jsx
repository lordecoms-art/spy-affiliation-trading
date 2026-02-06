import Card from './Card';

export default function StatCard({ icon: Icon, label, value, change, iconColor = 'text-emerald-500' }) {
  const isPositive = change && !change.startsWith('-');

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <p className="text-3xl font-bold text-zinc-100">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change && (
            <p
              className={`text-sm font-medium ${
                isPositive ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {change}
              <span className="text-zinc-500 ml-1">vs last week</span>
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg bg-zinc-800/50 ${iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  );
}
