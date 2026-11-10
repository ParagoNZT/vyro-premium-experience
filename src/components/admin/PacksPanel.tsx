import { PackagePlus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatPrice, packDevices } from "@/config/site";
import type { LicensePack } from "@/lib/license-packs";
import { portalApi, PortalApiError } from "@/lib/portal-api";
import { AdminDialog, AdminField, AdminNotice } from "./AdminControls";
import { AdminStatus, AdminTable } from "./AdminTable";

export function PacksPanel({ onAccessDenied }: { onAccessDenied: (status: 401 | 403) => void }) {
  const [packs, setPacks] = useState<LicensePack[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [devices, setDevices] = useState("1");
  const [months, setMonths] = useState("12");
  const [lifetime, setLifetime] = useState(false);
  const [price, setPrice] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  const create = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void portalApi<{ packs: LicensePack[] }>("/api/manage?packs=1", { signal: controller.signal })
      .then(({ packs }) => {
        if (!controller.signal.aborted) setPacks(packs);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PortalApiError && (error.status === 401 || error.status === 403))
          onAccessDenied(error.status);
        else setIssue("Impossible de charger le catalogue.");
      });
    return () => controller.abort();
  }, [revision, onAccessDenied]);

  function open(pack: LicensePack | null, button: HTMLElement) {
    trigger.current = button;
    setName(pack?.name ?? "");
    setDevices(String(pack?.devices ?? 1));
    setMonths(String(pack?.months ?? 12));
    setLifetime(!!pack && pack.months === null);
    setPrice(pack?.priceCents == null ? "" : String(pack.priceCents / 100));
    setIssue("");
    setNotice("");
    setFormError("");
    setForm(pack ? { id: pack.id } : {});
  }

  async function change(body: object, success: string, inDialog: boolean) {
    if (busy) return;
    setBusy(true);
    setIssue("");
    setFormError("");
    setNotice("");
    try {
      await portalApi("/api/manage", { method: "POST", body });
      setForm(null);
      setNotice(success);
      setRevision((value) => value + 1);
    } catch (error) {
      if (error instanceof PortalApiError && (error.status === 401 || error.status === 403))
        onAccessDenied(error.status);
      else
        (inDialog ? setFormError : setIssue)(
          error instanceof PortalApiError ? error.message : "Impossible d’enregistrer le pack.",
        );
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    void change(
      {
        action: "save-pack",
        id: form.id,
        name,
        devices: Number(devices),
        months: lifetime ? null : Number(months),
        priceCents: price === "" ? null : Math.round(Number(price) * 100),
      },
      form.id ? "Pack mis à jour." : "Pack créé et disponible pour les nouvelles attributions.",
      true,
    );
  }

  return (
    <div className="va-stack">
      {notice && <AdminNotice>{notice}</AdminNotice>}
      {issue && <AdminNotice error>{issue}</AdminNotice>}
      <section className="va-card va-records" aria-labelledby="pack-catalogue">
        <div className="va-card-head">
          <div>
            <h2 id="pack-catalogue">Catalogue des packs</h2>
            <p>
              Les packs personnalisés restent dans la console. Leur prix est indicatif ; aucune
              attribution ne déclenche un paiement.
            </p>
          </div>
          <div className="va-actions">
            <button
              className="va-button va-button-primary"
              type="button"
              ref={create}
              disabled={busy}
              onClick={(event) => open(null, event.currentTarget)}
            >
              <PackagePlus size={17} aria-hidden /> Créer un pack
            </button>
          </div>
        </div>
        {!packs ? (
          issue ? (
            <div className="va-state">
              <button
                className="va-button va-button-secondary"
                type="button"
                onClick={() => {
                  setIssue("");
                  setRevision((value) => value + 1);
                }}
              >
                Réessayer
              </button>
            </div>
          ) : (
            <p className="va-state" role="status">
              Chargement du catalogue…
            </p>
          )
        ) : (
          <AdminTable
            label="Catalogue des packs"
            columns={["Pack", "Appareils", "Durée", "Prix indicatif", "Statut", "Actions"]}
          >
            {packs.map((pack) => (
              <tr key={pack.id}>
                <td className="va-person">
                  <strong>{pack.name}</strong>
                  <small>{pack.updatedAt ? "Personnalisé" : "Offre VYRO"}</small>
                </td>
                <td>{packDevices(pack)}</td>
                <td>{pack.months === null ? "Sans échéance" : `${pack.months} mois`}</td>
                <td>{pack.priceCents === null ? "—" : formatPrice(pack.priceCents / 100)}</td>
                <td>
                  <AdminStatus tone={pack.enabled ? "positive" : "neutral"}>
                    {pack.enabled ? "Disponible" : "Archivé"}
                  </AdminStatus>
                </td>
                <td>
                  {pack.updatedAt ? (
                    <div className="va-table-actions">
                      <button
                        className="va-row-action"
                        type="button"
                        disabled={busy}
                        aria-label={`Modifier le pack ${pack.name}`}
                        onClick={(event) => open(pack, event.currentTarget)}
                      >
                        Modifier
                      </button>
                      <button
                        className="va-row-action"
                        type="button"
                        disabled={busy}
                        aria-label={`${pack.enabled ? "Archiver" : "Réactiver"} le pack ${pack.name}`}
                        onClick={() =>
                          void change(
                            { action: "pack-availability", id: pack.id, enabled: !pack.enabled },
                            pack.enabled
                              ? "Pack archivé. Les licences attribuées sont conservées."
                              : "Pack réactivé.",
                            false,
                          )
                        }
                      >
                        {pack.enabled ? "Archiver" : "Réactiver"}
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </section>
      <AdminDialog
        open={!!form}
        busy={busy}
        title={form?.id ? "Modifier le pack" : "Créer un pack personnalisé"}
        description="Les réglages s’appliquent aux nouvelles attributions. Les licences déjà attribuées sont conservées."
        onClose={() => setForm(null)}
        returnFocus={() => (trigger.current?.isConnected ? trigger.current : create.current)}
      >
        <form className="va-form" onSubmit={submit} aria-busy={busy}>
          <AdminField
            label="Nom du pack"
            value={name}
            onChange={setName}
            minLength={2}
            maxLength={80}
            required
          />
          <div className="va-form-grid">
            <AdminField
              label="Appareils autorisés"
              type="number"
              value={devices}
              onChange={setDevices}
              min={1}
              max={10}
              required
            />
            <AdminField
              label="Prix indicatif (€)"
              type="number"
              value={price}
              onChange={setPrice}
              min={0}
              max={9999.99}
              step={0.01}
              hint="Facultatif."
            />
          </div>
          <label className="va-checkbox">
            <input
              type="checkbox"
              checked={lifetime}
              onChange={(event) => setLifetime(event.target.checked)}
            />{" "}
            Licence sans échéance
          </label>
          {!lifetime && (
            <AdminField
              label="Durée en mois"
              type="number"
              value={months}
              onChange={setMonths}
              min={1}
              max={120}
              required
            />
          )}
          {formError && <AdminNotice error>{formError}</AdminNotice>}
          <div className="va-actions">
            <button className="va-button va-button-primary" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer le pack"}
            </button>
            <button
              className="va-button va-button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setForm(null)}
            >
              Annuler
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
