export default function Card({ children, className = '', onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 ${
        hover ? 'hover:border-zinc-700 cursor-pointer transition-colors' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
