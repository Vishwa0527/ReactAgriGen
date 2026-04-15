import { useState, useMemo } from 'react';
import { estimationStore } from '../data/estimationStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { workshopStore } from '../data/workshopStore';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'est';

const STATUS_BADGE = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' };

function fmtCurrency(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const EMPTY = {
  fixedAssetID: '', estimateCode: '', totalEstimatedCost: '',
  estimationDate: '', workshopID: '', groupID: '', estateID: '', status: 'Pending',
  details: [],
};
const EMPTY_LINE = { skuID: '', quantity: '', unitCost: '', estimatedCost: '' };

function validate(form, editingID) {
  const e = {};
  if (!form.fixedAssetID)      e.fixedAssetID = 'Asset is required';
  if (!form.estimateCode.trim()) {
    e.estimateCode = 'Code is required';
  } else if (!estimationStore.isCodeUnique(form.estimateCode.trim().toUpperCase(), editingID)) {
    e.estimateCode = 'Code already in use';
  }
  if (!form.estimationDate)    e.estimationDate = 'Date is required';
  if (!form.workshopID)        e.workshopID = 'Workshop is required';
  if (form.details.length === 0) e._items = 'At least one line item is required';
  return e;
}

export default function Estimations() {
  const [data, setData]       = useState(() => estimationStore.getAll());
  const [assets]              = useState(() => fixedAssetStore.getAll());
  const [workshops]           = useState(() => workshopStore.getAll());
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Enrichment */
  const enriched = useMemo(() => data.map(e => ({
    ...e,
    _asset:    assets.find(a => a.id === e.fixedAssetID),
    _workshop: MOCK.workshops.find(w => w.id === e.workshopID),
  })), [data, assets]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterStatus !== 'All') rows = rows.filter(r => r.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.estimateCode?.toLowerCase().includes(q) ||
        r._asset?.code?.toLowerCase().includes(q) ||
        r._asset?.name?.toLowerCase().includes(q) ||
        r._workshop?.name?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, search, filterStatus]);

  /* Stats */
  const totalEstimated = data.reduce((s, e) => s + (e.totalEstimatedCost || 0), 0);
  const pendingCount   = data.filter(e => e.status === 'Pending').length;

  /* Form helpers */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  /* Line item management */
  const addLine = () => setForm(f => ({ ...f, details: [...f.details, { ...EMPTY_LINE }] }));
  const removeLine = (idx) => setForm(f => ({ ...f, details: f.details.filter((_, i) => i !== idx) }));
  const setLine = (idx, key, val) => {
    setForm(f => {
      const details = f.details.map((d, i) => {
        if (i !== idx) return d;
        const updated = { ...d, [key]: val };
        // Auto-calc estimated cost
        if (key === 'quantity' || key === 'unitCost') {
          updated.estimatedCost = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitCost) || 0);
        }
        return updated;
      });
      // Recalculate total
      const totalEstimatedCost = details.reduce((s, d) => s + (parseFloat(d.estimatedCost) || 0), 0);
      return { ...f, details, totalEstimatedCost };
    });
  };

  const open = (row) => {
    if (row) {
      setForm({
        fixedAssetID:      row.fixedAssetID ?? '',
        estimateCode:      row.estimateCode ?? '',
        totalEstimatedCost: row.totalEstimatedCost ?? '',
        estimationDate:    row.estimationDate ?? '',
        workshopID:        row.workshopID ?? '',
        groupID:           row.groupID ?? '',
        estateID:          row.estateID ?? '',
        status:            row.status ?? 'Pending',
        details:           row.details?.map(d => ({ ...d })) || [],
      });
    } else {
      setForm({ ...EMPTY, estimateCode: estimationStore.nextCode(), details: [] });
    }
    setErrors({});
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = modal !== 'add' ? modal.id : null;
    const errs = validate(form, editingID);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const selectedAsset = assets.find(a => a.id === Number(form.fixedAssetID));
    const payload = {
      ...form,
      estimateCode:      form.estimateCode.trim().toUpperCase(),
      fixedAssetID:      Number(form.fixedAssetID),
      workshopID:        Number(form.workshopID),
      groupID:           selectedAsset?.groupID || Number(form.groupID) || null,
      estateID:          selectedAsset?.estateID || Number(form.estateID) || null,
      totalEstimatedCost: parseFloat(form.totalEstimatedCost) || 0,
      details: form.details.map(d => ({
        ...d,
        fixedAssetID:  Number(form.fixedAssetID),
        skuID:         d.skuID ? Number(d.skuID) : null,
        quantity:      parseInt(d.quantity) || 0,
        unitCost:      parseFloat(d.unitCost) || 0,
        estimatedCost: parseFloat(d.estimatedCost) || 0,
        workshopID:    Number(form.workshopID),
        groupID:       selectedAsset?.groupID || null,
        estateID:      selectedAsset?.estateID || null,
      })),
    };

    if (modal === 'add') estimationStore.add(payload);
    else                 estimationStore.update(modal.id, payload);
    setData(estimationStore.getAll());
    close();
  };

  const del = () => {
    estimationStore.remove(confirmDelete.id);
    setData(estimationStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Stats */}
      <div className="fade-up">
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          <div className="summary-card">
            <div className="summary-card-icon teal"><Icon name="clipboard" /></div>
            <div className="summary-card-value">{data.length}</div>
            <div className="summary-card-label">Total Estimations</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon blue"><Icon name="dollar" /></div>
            <div className="summary-card-value">{fmtCurrency(totalEstimated)}</div>
            <div className="summary-card-label">Total Estimated Cost</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon amber"><Icon name="alert" /></div>
            <div className="summary-card-value">{pendingCount}</div>
            <div className="summary-card-label">Pending Approval</div>
          </div>
        </div>
      </div>

      <ListingPage
        idPrefix={ID}
        title="Estimations"
        subtitle="Pre-maintenance cost estimates for fixed assets"
        columns={[
          {
            key: 'estimateCode',
            label: 'Code',
            render: v => <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{v}</span>,
          },
          {
            key: '_asset',
            label: 'Asset',
            render: v => v ? (
              <div>
                <span style={{
                  display: 'inline-flex', padding: '0 6px', height: 22,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 10,
                  alignItems: 'center', marginRight: 6,
                }}>{v.code}</span>
                <span style={{ fontSize: 12 }}>{v.name}</span>
              </div>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'estimationDate',
            label: 'Date',
            render: v => <span style={{ fontSize: 12 }}>{fmtDate(v)}</span>,
          },
          {
            key: '_workshop',
            label: 'Workshop',
            render: v => v
              ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'totalEstimatedCost',
            label: 'Est. Cost',
            render: v => <span style={{ fontWeight: 600, fontSize: 12 }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'details',
            label: 'Items',
            render: v => <span className="badge badge-info" style={{ fontSize: 10 }}>{v?.length || 0} item{(v?.length || 0) !== 1 ? 's' : ''}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Estimation"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <input id={`${ID}-input-search`} className="form-control"
                placeholder="Search by code, asset, workshop…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
              {['All', 'Pending', 'Approved', 'Rejected'].map((s, i, arr) => (
                <button key={s} id={`${ID}-btn-status-${s.toLowerCase()}`}
                  style={{
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 0, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                    background: filterStatus === s ? 'var(--primary)' : 'transparent',
                    color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                    fontWeight: filterStatus === s ? 600 : 400,
                  }}
                  onClick={() => setFilterStatus(s)}>{s}</button>
              ))}
            </div>
            {(search || filterStatus !== 'All') && (
              <button id={`${ID}-btn-filter-clear`} className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterStatus('All'); }}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} of {data.length}</span>
          </div>
        }
      />

      {/* Add / Edit Modal (wider for line items) */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Create Estimation' : 'Edit Estimation'}
          subtitle={modal === 'add' ? 'Estimate maintenance costs before work begins' : `Editing: ${modal.estimateCode}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
          wide
        >
          {/* Header Fields */}
          <p className="section-label">Estimation Header</p>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Fixed Asset <span className="required">*</span></label>
              <select id={`${ID}-select-asset`} className={`form-control${errors.fixedAssetID ? ' input-error' : ''}`}
                value={form.fixedAssetID} onChange={e => set('fixedAssetID', e.target.value)}>
                <option value="">— Select Asset —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
              {errors.fixedAssetID && <span className="field-error">{errors.fixedAssetID}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Estimate Code <span className="required">*</span></label>
              <input id={`${ID}-input-code`} className={`form-control${errors.estimateCode ? ' input-error' : ''}`}
                value={form.estimateCode} onChange={e => set('estimateCode', e.target.value.toUpperCase())} placeholder="e.g. EST-0004" />
              {errors.estimateCode ? <span className="field-error">{errors.estimateCode}</span> : <span className="field-hint">Auto-generated</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Estimation Date <span className="required">*</span></label>
              <input id={`${ID}-input-date`} className={`form-control${errors.estimationDate ? ' input-error' : ''}`}
                type="date" value={form.estimationDate} onChange={e => set('estimationDate', e.target.value)} />
              {errors.estimationDate && <span className="field-error">{errors.estimationDate}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Workshop <span className="required">*</span></label>
              <select id={`${ID}-select-workshop`} className={`form-control${errors.workshopID ? ' input-error' : ''}`}
                value={form.workshopID} onChange={e => set('workshopID', e.target.value)}>
                <option value="">— Select Workshop —</option>
                {workshops.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
              {errors.workshopID && <span className="field-error">{errors.workshopID}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select id={`${ID}-select-status`} className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Total Estimated Cost</label>
              <input id={`${ID}-input-total`} className="form-control" type="number" readOnly
                value={form.totalEstimatedCost} style={{ background: '#f8fafc', fontWeight: 700 }} />
              <span className="field-hint">Auto-calculated from line items</span>
            </div>
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* Line Items */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="section-label" style={{ marginBottom: 0 }}>Line Items</p>
            <button id={`${ID}-btn-addLine`} className="btn btn-secondary btn-sm" onClick={addLine}>
              <Icon name="plus" style={{ width: 12, height: 12 }} /> Add Item
            </button>
          </div>

          {errors._items && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 'var(--radius-sm)', marginBottom: 10 }}>
              <span className="field-error">{errors._items}</span>
            </div>
          )}

          {form.details.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No line items. Click "Add Item" to start estimating.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 80px 100px 110px auto',
                gap: 8, padding: '6px 12px', fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)',
              }}>
                <span>SKU / Material</span><span>Qty</span><span>Unit Cost</span><span>Est. Cost</span><span></span>
              </div>

              {form.details.map((line, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '2fr 80px 100px 110px auto',
                  gap: 8, padding: '8px 12px', alignItems: 'center',
                  background: idx % 2 === 0 ? 'var(--bg-page)' : 'white',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  marginBottom: 4,
                }}>
                  <select id={`${ID}-line-sku-${idx}`} className="form-control"
                    value={line.skuID || ''} onChange={e => setLine(idx, 'skuID', e.target.value)}
                    style={{ height: 32, fontSize: 12 }}>
                    <option value="">— SKU —</option>
                    {MOCK.skuMaster.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                  <input id={`${ID}-line-qty-${idx}`} className="form-control" type="number" min="0" step="1"
                    value={line.quantity || ''} onChange={e => setLine(idx, 'quantity', e.target.value)}
                    placeholder="0" style={{ height: 32, fontSize: 12 }} />
                  <input id={`${ID}-line-unitCost-${idx}`} className="form-control" type="number" min="0" step="0.01"
                    value={line.unitCost || ''} onChange={e => setLine(idx, 'unitCost', e.target.value)}
                    placeholder="0.00" style={{ height: 32, fontSize: 12 }} />
                  <input id={`${ID}-line-estCost-${idx}`} className="form-control" readOnly
                    value={line.estimatedCost ? Number(line.estimatedCost).toLocaleString('en-LK') : '0'}
                    style={{ height: 32, fontSize: 12, fontWeight: 700, background: '#f8fafc', textAlign: 'right' }} />
                  <button id={`${ID}-btn-removeLine-${idx}`} className="btn btn-danger btn-sm" onClick={() => removeLine(idx)} style={{ height: 32, padding: '0 8px' }}>
                    <Icon name="trash" style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              ))}

              {/* Total row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 80px 100px 110px auto',
                gap: 8, padding: '10px 12px', marginTop: 4,
                borderTop: '2px solid var(--primary)', fontWeight: 700,
              }}>
                <span style={{ fontSize: 12, color: 'var(--primary-dark)' }}>TOTAL</span>
                <span></span><span></span>
                <span style={{ fontSize: 13, color: 'var(--primary-dark)', textAlign: 'right' }}>
                  {fmtCurrency(form.totalEstimatedCost)}
                </span>
                <span></span>
              </div>
            </>
          )}
        </FormModal>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#fee2e2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Estimation</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Delete estimation <strong>{confirmDelete.estimateCode}</strong> for{' '}
                <strong>{nameOf.fixedAssetName(confirmDelete.fixedAssetID)}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Estimated: {fmtCurrency(confirmDelete.totalEstimatedCost)} · {confirmDelete.details?.length || 0} line items
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
