import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeftRight, Boxes, Package, TriangleAlert } from "lucide-react";

const links = [
  { to: "/", label: "Inventory", icon: Package, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/low-stock", label: "Low stock", icon: TriangleAlert },
];

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar__brand">
          <span className="sidebar__logo">
            <Boxes size={20} strokeWidth={1.9} />
          </span>
          <span>
            <strong>Stockroom</strong>
            <small>Inventory control</small>
          </span>
        </NavLink>

        <span className="sidebar__label">Workspace</span>
        <nav className="sidebar__nav" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar__link${isActive ? " is-active" : ""}`
              }
            >
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__note">
          <span className="sidebar__dot" />
          <div>
            <strong>Every change is logged</strong>
            <p>Stock updates create a ledger entry you can audit later.</p>
          </div>
        </div>

        <span className="sidebar__version">Stockroom v1.0</span>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
