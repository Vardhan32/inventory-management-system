export default function StatCard({ label, value, note, icon: Icon, tone = "default" }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {note ? <span className="stat-card__note">{note}</span> : null}
    </article>
  );
}
