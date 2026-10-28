import { Link } from "react-router-dom";
import { ArrowLeft, PackageSearch } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <span className="not-found__icon">
        <PackageSearch size={30} strokeWidth={1.6} />
      </span>
      <span className="eyebrow">404</span>
      <h1>This shelf is empty</h1>
      <p>
        The page you asked for does not exist. It may have moved, or the link was
        mistyped.
      </p>
      <div className="not-found__actions">
        <Link to="/" className="btn btn--primary">
          <ArrowLeft size={16} />
          Back to inventory
        </Link>
        <Link to="/transactions" className="btn btn--ghost">
          View transactions
        </Link>
      </div>
    </div>
  );
}
