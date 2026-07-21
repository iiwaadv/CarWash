import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface Balance {
  quantity: number;
  branch: { id: number; name: string };
}

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  warehouseQty: number;
  balances: Balance[];
}

interface SalesTarget {
  id: number;
  period: string;
  amount: number;
  targetQty: number | null;
  branch: { id: number; name: string };
  service: { id: number; serviceName: string } | null;
}

interface Service {
  id: number;
  serviceName: string;
}

interface TargetProgress {
  target: SalesTarget;
  achievedQty: number;
  achievedAmount: number;
  remainingAmount: number;
  remainingQty: number | null;
  amountPct: number | null;
  qtyPct: number | null;
  bestEmployee: { name: string; count: number } | null;
}

interface Movement {
  id: number;
  type: string;
  quantity: number;
  recipientName: string | null;
  notes: string | null;
  createdAt: string;
  item: { name: string; unit: string };
  branch: { name: string } | null;
}

export default function Materials() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [progress, setProgress] = useState<TargetProgress[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("liter");
  const [warehouseQty, setWarehouseQty] = useState("0");
  const [moveItemId, setMoveItemId] = useState("");
  const [moveType, setMoveType] = useState("warehouse_in");
  const [moveQty, setMoveQty] = useState("");
  const [moveBranchId, setMoveBranchId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [targetPeriod, setTargetPeriod] = useState("daily");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetServiceId, setTargetServiceId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [b, i, tg, mv, svc, prog] = await Promise.all([
      apiFetch("/api/branches", token),
      apiFetch("/api/inventory/items", token),
      apiFetch("/api/sales-targets", token),
      apiFetch("/api/inventory/movements", token),
      apiFetch("/api/services", token).catch(() => []),
      apiFetch("/api/sales-targets/progress", token).catch(() => []),
    ]);
    setBranches(b);
    setItems(i);
    setTargets(tg);
    setMovements(mv);
    setServices(svc);
    setProgress(prog);
    if (b.length && !targetBranchId) setTargetBranchId(String(b[0].id));
    if (b.length && !moveBranchId) setMoveBranchId(String(b[0].id));
    if (i.length && !moveItemId) setMoveItemId(String(i[0].id));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetchJson("/api/inventory/items", token, "POST", {
        name: itemName.trim(),
        unit: itemUnit,
        warehouseQty: Number(warehouseQty) || 0,
      });
      setItemName("");
      setWarehouseQty("0");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetchJson("/api/inventory/movements", token, "POST", {
        itemId: Number(moveItemId),
        type: moveType,
        quantity: Number(moveQty),
        branchId: moveType === "warehouse_in" ? undefined : Number(moveBranchId),
        recipientName: recipient || undefined,
      });
      setMoveQty("");
      setRecipient("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addTarget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetchJson("/api/sales-targets", token, "POST", {
        branchId: Number(targetBranchId),
        period: targetPeriod,
        amount: Number(targetAmount),
        serviceId: targetServiceId ? Number(targetServiceId) : null,
        targetQty: targetQty ? Number(targetQty) : null,
      });
      setTargetAmount("");
      setTargetQty("");
      setTargetServiceId("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-title">{t("materials.title")}</div>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      <div className="section-card">
        <div className="section-title">{t("materials.targetsTitle")}</div>
        <form onSubmit={addTarget}>
          <div className="form-row">
            <select value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)}>
              <option value="daily">{t("materials.period.daily")}</option>
              <option value="weekly">{t("materials.period.weekly")}</option>
              <option value="monthly">{t("materials.period.monthly")}</option>
            </select>
            <select value={targetServiceId} onChange={(e) => setTargetServiceId(e.target.value)}>
              <option value="">{t("materials.allServices")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serviceName}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("materials.targetAmountPlaceholder")}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder={t("materials.targetQtyPlaceholder")}
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
            />
            <button className="btn">{t("common.save")}</button>
          </div>
        </form>
        <table>
          <thead>
            <tr>
              <th>{t("materials.colBranch")}</th>
              <th>{t("materials.colPeriod")}</th>
              <th>{t("materials.colService")}</th>
              <th>{t("materials.colAmount")}</th>
              <th>{t("materials.colTargetQty")}</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((tg) => (
              <tr key={tg.id}>
                <td>{tg.branch.name}</td>
                <td>{t(`materials.period.${tg.period}`)}</td>
                <td>{tg.service?.serviceName ?? t("materials.allServices")}</td>
                <td>
                  {tg.amount.toFixed(2)} {t("common.riyal")}
                </td>
                <td>{tg.targetQty ?? "—"}</td>
              </tr>
            ))}
            {targets.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {t("materials.emptyTargets")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {progress.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 16 }}>
              {t("materials.progressTitle")}
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("materials.colBranch")}</th>
                  <th>{t("materials.colService")}</th>
                  <th>{t("materials.colAchieved")}</th>
                  <th>{t("materials.colProgress")}</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.target.id}>
                    <td>{p.target.branch.name}</td>
                    <td>{p.target.service?.serviceName ?? t("materials.allServices")}</td>
                    <td>
                      {p.achievedAmount.toFixed(0)} {t("common.riyal")}
                      {p.target.targetQty != null && ` · ${p.achievedQty}/${p.target.targetQty}`}
                    </td>
                    <td>
                      {p.amountPct != null && `${p.amountPct}%`}
                      {p.qtyPct != null && ` · ${p.qtyPct}% ${t("materials.qtyProgress")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="section-card">
        <div className="section-title">{t("materials.itemsTitle")}</div>
        <form onSubmit={addItem}>
          <div className="form-row">
            <input
              placeholder={t("materials.itemNamePlaceholder")}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
            <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)}>
              <option value="liter">{t("materials.unit.liter")}</option>
              <option value="piece">{t("materials.unit.piece")}</option>
              <option value="kg">{t("materials.unit.kg")}</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("materials.warehouseQtyPlaceholder")}
              value={warehouseQty}
              onChange={(e) => setWarehouseQty(e.target.value)}
            />
            <button className="btn">{t("common.add")}</button>
          </div>
        </form>
        <table>
          <thead>
            <tr>
              <th>{t("materials.colItem")}</th>
              <th>{t("materials.colUnit")}</th>
              <th>{t("materials.colWarehouse")}</th>
              <th>{t("materials.colBranchBalances")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 700 }}>{item.name}</td>
                <td>{t(`materials.unit.${item.unit}`, item.unit)}</td>
                <td>{item.warehouseQty}</td>
                <td>
                  {item.balances.length === 0
                    ? "—"
                    : item.balances.map((b) => `${b.branch.name}: ${b.quantity}`).join(" · ")}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  {t("materials.emptyItems")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-card">
        <div className="section-title">{t("materials.movementTitle")}</div>
        <form onSubmit={submitMovement}>
          <div className="form-row">
            <select value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <select value={moveType} onChange={(e) => setMoveType(e.target.value)}>
              <option value="warehouse_in">{t("materials.move.warehouse_in")}</option>
              <option value="deliver_to_branch">{t("materials.move.deliver_to_branch")}</option>
              <option value="consume">{t("materials.move.consume")}</option>
            </select>
            {moveType !== "warehouse_in" && (
              <select value={moveBranchId} onChange={(e) => setMoveBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder={t("materials.qtyPlaceholder")}
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
              required
            />
            {moveType === "deliver_to_branch" && (
              <input
                placeholder={t("materials.recipientPlaceholder")}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            )}
            <button className="btn" disabled={!moveItemId}>
              {t("common.save")}
            </button>
          </div>
        </form>
        <table>
          <thead>
            <tr>
              <th>{t("materials.colItem")}</th>
              <th>{t("materials.colType")}</th>
              <th>{t("materials.colBranch")}</th>
              <th>{t("materials.colQty")}</th>
              <th>{t("materials.colRecipient")}</th>
              <th>{t("materials.colDate")}</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{m.item.name}</td>
                <td>{t(`materials.move.${m.type}`, m.type)}</td>
                <td>{m.branch?.name ?? "—"}</td>
                <td>
                  {m.quantity} {t(`materials.unit.${m.item.unit}`, m.item.unit)}
                </td>
                <td>{m.recipientName ?? "—"}</td>
                <td>{new Date(m.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
