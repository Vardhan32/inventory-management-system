import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import InventoryPage from "./pages/InventoryPage";
import LowStockPage from "./pages/LowStockPage";
import NotFoundPage from "./pages/NotFoundPage";
import TransactionsPage from "./pages/TransactionsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<InventoryPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="low-stock" element={<LowStockPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
