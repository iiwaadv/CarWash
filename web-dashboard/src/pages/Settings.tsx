import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface Bay {
  id: number;
  branchId: number;
  bayName: string;
  bayType: string | null;
  branch?: { name: string };
}

interface Service {
  id: number;
  serviceName: string;
  basePrice: number;
  suggestedTrigger: string | null;
}

export default function Settings() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bayName, setBayName] = useState("");
  const [bayBranchId, setBayBranchId] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [trigger, setTrigger] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [b, bayData, svc] = await Promise.all([
      apiFetch("/api/branches", token),
      apiFetch("/api/bays", token),
      apiFetch("/api/services", token),
    ]);
    setBranches(b);
    setBays(bayData);
    setServices(svc);
    if (b.length && bayBranchId === null) setBayBranchId(b[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const baysByBranch = useMemo(() => {
    const map = new Map<string, Bay[]>();
    for (const bay of bays) {
      const key = bay.branch?.name ?? String(bay.branchId);
      const list = map.get(key) ?? [];
      list.push(bay);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [bays]);

  async function addBay(e: React.FormEvent) {
    e.preventDefault();
    if (!bayBranchId || !bayName.trim()) return;
    setError(null);
    try {
      await apiFetchJson("/api/bays", token, "POST", { branchId: bayBranchId, bayName: bayName.trim() });
      setBayName("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function renameBay(bay: Bay) {
    const next = prompt(t("settings.renameBayPrompt"), bay.bayName);
    if (!next?.trim() || next.trim() === bay.bayName) return;
    await apiFetchJson(`/api/bays/${bay.id}`, token, "PATCH", { bayName: next.trim() });
    load();
  }

  async function deleteBay(bay: Bay) {
    if (!confirm(t("settings.deleteBayConfirm", { name: bay.bayName }))) return;
    await apiFetch(`/api/bays/${bay.id}`, token, { method: "DELETE" });
    load();
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceName.trim() || !basePrice) return;
    setError(null);
    try {
      await apiFetchJson("/api/services", token, "POST", {
        serviceName: serviceName.trim(),
        basePrice: Number(basePrice),
        suggestedTrigger: trigger || undefined,
      });
      setServiceName("");
      setBasePrice("");
      setTrigger("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function editService(svc: Service) {
    const name = prompt(t("settings.renameServicePrompt"), svc.serviceName);
    if (!name?.trim()) return;
    const priceRaw = prompt(t("settings.pricePrompt"), String(svc.basePrice));
    if (priceRaw == null) return;
    await apiFetchJson(`/api/services/${svc.id}`, token, "PATCH", {
      serviceName: name.trim(),
      basePrice: Number(priceRaw),
    });
    load();
  }

  async function deleteService(svc: Service) {
    if (!confirm(t("settings.deleteServiceConfirm", { name: svc.serviceName }))) return;
    await apiFetch(`/api/services/${svc.id}`, token, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-title">{t("settings.title")}</div>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      <div className="section-card">
        <div className="section-title">{t("settings.baysTitle")}</div>
        <form onSubmit={addBay}>
          <div className="form-row">
            <select value={bayBranchId ?? ""} onChange={(e) => setBayBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              placeholder={t("settings.bayNamePlaceholder")}
              value={bayName}
              onChange={(e) => setBayName(e.target.value)}
              required
            />
            <button className="btn">{t("common.add")}</button>
          </div>
        </form>
        {baysByBranch.map(([branchName, list]) => (
          <div key={branchName} style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{branchName}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("settings.colBay")}</th>
                  <th>{t("settings.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((bay) => (
                  <tr key={bay.id}>
                    <td>{bay.bayName}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn secondary" onClick={() => renameBay(bay)}>
                        {t("common.edit")}
                      </button>
                      <button className="btn danger" onClick={() => deleteBay(bay)}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="section-card">
        <div className="section-title">{t("settings.servicesTitle")}</div>
        <form onSubmit={addService}>
          <div className="form-row">
            <input
              placeholder={t("settings.serviceNamePlaceholder")}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              required
            />
            <input
              placeholder={t("settings.pricePlaceholder")}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
            />
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              <option value="">{t("settings.triggerNone")}</option>
              <option value="small">{t("settings.triggerSmall")}</option>
              <option value="medium">{t("settings.triggerMedium")}</option>
              <option value="large">{t("settings.triggerLarge")}</option>
            </select>
            <button className="btn">{t("common.add")}</button>
          </div>
        </form>
        <table>
          <thead>
            <tr>
              <th>{t("settings.colService")}</th>
              <th>{t("settings.colPrice")}</th>
              <th>{t("settings.colTrigger")}</th>
              <th>{t("settings.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id}>
                <td>{svc.serviceName}</td>
                <td>
                  {svc.basePrice.toFixed(2)} {t("common.riyal")}
                </td>
                <td>{svc.suggestedTrigger ?? "—"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn secondary" onClick={() => editService(svc)}>
                    {t("common.edit")}
                  </button>
                  <button className="btn danger" onClick={() => deleteService(svc)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
