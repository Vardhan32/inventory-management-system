import { PackageSearch } from "lucide-react";

export default function EmptyState({ icon: Icon = PackageSearch, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon size={25} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
