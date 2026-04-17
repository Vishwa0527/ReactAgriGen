import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assetMaintenanceStore } from '../data/assetMaintenanceStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetHistoryStore } from '../data/fixedAssetHistoryStore';
import { workshopStore } from '../data/workshopStore';
import { MOCK, nameOf } from '../data/mockData';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { GLEffectPanel }      from '../components/GLEffectPanel';
import { glEngine }           from '../utils/glEngine';
import { Icon } from '../components/Icon';

const ID = 'amf';

const EMPTY = {
  groupID: '', estateID: '', fixedAssetID: '', maintenanceCode: '',
  maintenanceDate: '', totalMaintenanceCost: '', workshopID: '', status: 'Active',
  details: [], costs: [],
};

const EMPTY_DETAIL = { isEmployeeEnabled: true, employeeID: '', taskDescription: '', workshopID: '' };
const EMPTY_COST   = { fixedAssetID: '', estimateCode: '', totalMaintenanceCost: '', maintenanceDate: '', workshopID: '' };

function validate(form, editingID) {
  const e = {};
  if (!form.groupID)           e.groupID   = 'Group is required';
  if (!form.estateID)          e.estateID  = 'Estate is required';
  if (!form.fixedAssetID)      e.fixedAssetID = 'Asset is required';
  if (!form.maintenanceCode.trim()) {
    e.maintenanceCode = 'Code is required';
  } else if (!assetMaintenanceStore.isCodeUnique(form.maintenanceCode.trim().toUpperCase(), editingID)) {
    e.maintenanceCode = 'Code already in use';
  }
  if (!form.maintenanceDate)   e.maintenanceDate = 'Date is required';
  if (!form.workshopID)        e.workshopID = 'Workshop is required';
  const cost = parseFloat(form.totalMaintenanceCost);
  if (!cost || cost <= 0)      e.totalMaintenanceCost = 'Cost must be > 0';
  return e;
}

export default function AssetMaintenanceForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);
  const existing = isEdit ? assetMaintenanceStore.getById(id) : null;

  const [assets]    = useState(() => fixedAssetStore.getAll());
  const [workshops] = useState(() => workshopStore.getAll());

  const [form, setForm] = useState(() =>
    existing ? {
      groupID:              existing.groupID ?? '',
      estateID:             existing.estateID ?? '',
      fixedAssetID:         existing.fixedAssetID ?? '',
      maintenanceCode:      existing.maintenanceCode ?? '',
      maintenanceDate:      existing.maintenanceDate ?? '',
      totalMaintenanceCost: existing.totalMaintenanceCost ?? '',
      workshopID:           existing.workshopID ?? '',
      status:               existing.status ?? 'Active',
      details:              existing.details?.map(d => ({ ...d })) || [],
      costs:                existing.costs?.map(c => ({ ...c })) || [],
    } : { ...EMPTY, maintenanceCode: assetMaintenanceStore.nextCode(), details: [], costs: [] }
  );
  const [errors, setErrors] = useState({});

  /* ── GL workflow state (edit-mode only) ── */
  const [glState, setGLState] = useState(() => ({
    GLApprovalStatus: existing?.GLApprovalStatus ?? 'Draft',
    GLPostingRef:     existing?.GLPostingRef     ?? null,
    GLRejectionNote:  existing?.GLRejectionNote  ?? null,
    IsPostedToGL:     existing?.IsPostedToGL     ?? false,
  }));

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  /* Dynamic detail rows */
  const addDetail = () => {
    setForm(f => ({ ...f, details: [...f.details, { ...EMPTY_DETAIL, workshopID: f.workshopID }] }));
  };
  const removeDetail = (idx) => {
    setForm(f => ({ ...f, details: f.details.filter((_, i) => i !== idx) }));
  };
  const setDetail = (idx, key, val) => {
    setForm(f => ({
      ...f,
      details: f.details.map((d, i) => i === idx ? { ...d, [key]: val } : d),
    }));
  };

  /* Dynamic cost rows */
  const addCost = () => {
    setForm(f => ({
      ...f,
      costs: [...f.costs, { ...EMPTY_COST, fixedAssetID: f.fixedAssetID, maintenanceDate: f.maintenanceDate, workshopID: f.workshopID }],
    }));
  };
  const removeCost = (idx) => {
    setForm(f => ({ ...f, costs: f.costs.filter((_, i) => i !== idx) }));
  };
  const setCost = (idx, key, val) => {
    setForm(f => ({
      ...f,
      costs: f.costs.map((c, i) => i === idx ? { ...c, [key]: val } : c),
    }));
  };

  /* ── Derived selected asset (for GL type/category resolution) ── */
  const selectedAsset = useMemo(
    () => form.fixedAssetID ? assets.find(a => a.id === Number(form.fixedAssetID)) ?? null : null,
    [assets, form.fixedAssetID],
  );

  /* ── GL callbacks (edit-mode only) ── */
  const glCallbacks = isEdit ? {
    onConfirm: () => {
      const updates = { GLApprovalStatus: 'PendingApproval' };
      assetMaintenanceStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onApprove: () => {
      const result = glEngine.post({
        transactionTypeCode:  'FA_ASSET_MAINT',
        transactionDate:      new Date().toISOString().slice(0, 10),
        sourceTableName:      'AssetMaintenance',
        sourceRecordID:       existing.id,
        amount:               parseFloat(form.totalMaintenanceCost) || 0,
        fixedAssetTypeID:     selectedAsset?.fixedAssetTypeID     ?? null,
        fixedAssetCategoryID: selectedAsset?.fixedAssetCategoryID ?? null,
        description:          `Asset Maintenance — ${form.maintenanceCode}`,
        groupID:              Number(form.groupID)  || null,
        estateID:             Number(form.estateID) || null,
        createdBy:            'System',
      });
      if (result.success) {
        const updates = {
          GLApprovalStatus: 'Approved',
          IsPostedToGL:     true,
          GLPostingRef:     result.documentReference,
          GLApprovedDate:   new Date().toISOString().slice(0, 10),
        };
        assetMaintenanceStore.update(id, updates);
        setGLState(s => ({ ...s, ...updates }));
      }
    },
    onReject: (note) => {
      const updates = { GLApprovalStatus: 'Rejected', GLRejectionNote: note };
      assetMaintenanceStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onResubmit: () => {
      const updates = { GLApprovalStatus: 'PendingApproval', GLRejectionNote: null };
      assetMaintenanceStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
  } : {};

  /* Auto-fill from asset selection */
  const handleAssetSelect = (assetID) => {
    set('fixedAssetID', assetID);
    if (assetID) {
      const a = assets.find(x => x.id === Number(assetID));
      if (a) {
        setForm(f => ({ ...f, fixedAssetID: assetID, groupID: a.groupID || f.groupID, estateID: a.estateID || f.estateID }));
      }
    }
  };

  const handleSave = () => {
    const errs = validate(form, isEdit ? existing.id : null);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      ...form,
      maintenanceCode:      form.maintenanceCode.trim().toUpperCase(),
      fixedAssetID:         Number(form.fixedAssetID),
      groupID:              Number(form.groupID),
      estateID:             Number(form.estateID),
      workshopID:           Number(form.workshopID),
      totalMaintenanceCost: parseFloat(form.totalMaintenanceCost) || 0,
      details: form.details.map(d => ({
        ...d,
        employeeID:  d.employeeID ? Number(d.employeeID) : null,
        workshopID:  Number(form.workshopID),
        groupID:     Number(form.groupID),
        estateID:    Number(form.estateID),
      })),
      costs: form.costs.map(c => ({
        ...c,
        fixedAssetID:        Number(form.fixedAssetID),
        totalMaintenanceCost: parseFloat(c.totalMaintenanceCost) || 0,
        workshopID:          Number(form.workshopID),
        groupID:             Number(form.groupID),
        estateID:            Number(form.estateID),
      })),
    };

    if (isEdit) {
      assetMaintenanceStore.update(id, payload);
    } else {
      assetMaintenanceStore.add(payload);
      // Auto-create history snapshot
      const asset = fixedAssetStore.getById(payload.fixedAssetID);
      if (asset) {
        fixedAssetHistoryStore.addSnapshot(asset, 'Maintenance Impact', {
          presentValue: asset.totalCostOfAsset - (asset.depreciationValue || 0),
          assetMaintenanceID: id || Date.now(),
        });
      }
    }
    navigate('/asset-maintenance');
  };

  return (
    <div className="fade-up">
      {/* Page Title */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button id={`${ID}-btn-back`} className="btn btn-secondary btn-sm" onClick={() => navigate('/asset-maintenance')} style={{ gap: 4 }}>
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} /> Back
          </button>
          <div>
            <h1 className="page-title">{isEdit ? `Edit Maintenance — ${existing?.maintenanceCode}` : 'Record Asset Maintenance'}</h1>
            <p className="page-subtitle">{isEdit ? 'Update maintenance record' : 'Create a new asset maintenance record'}</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 1020 }}>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: Group & Estate */}
          <section>
            <p className="section-label">Group & Estate</p>
            <GroupEstateFields idPrefix={ID} groupID={form.groupID} estateID={form.estateID} onChange={set} errors={errors} />
          </section>

          <hr className="divider" />

          {/* Section 2: Asset & Maintenance Details */}
          <section>
            <p className="section-label">Maintenance Details</p>
            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label className="form-label">Fixed Asset <span className="required">*</span></label>
                <select id={`${ID}-select-asset`} className={`form-control${errors.fixedAssetID ? ' input-error' : ''}`}
                  value={form.fixedAssetID} onChange={e => handleAssetSelect(e.target.value)}>
                  <option value="">— Select Asset —</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
                {errors.fixedAssetID && <span className="field-error">{errors.fixedAssetID}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Maintenance Code <span className="required">*</span></label>
                <input id={`${ID}-input-code`} className={`form-control${errors.maintenanceCode ? ' input-error' : ''}`}
                  value={form.maintenanceCode} onChange={e => set('maintenanceCode', e.target.value.toUpperCase())} placeholder="e.g. AM-0003" />
                {errors.maintenanceCode ? <span className="field-error">{errors.maintenanceCode}</span> : <span className="field-hint">Auto-generated</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Maintenance Date <span className="required">*</span></label>
                <input id={`${ID}-input-date`} className={`form-control${errors.maintenanceDate ? ' input-error' : ''}`}
                  type="date" value={form.maintenanceDate} onChange={e => set('maintenanceDate', e.target.value)} />
                {errors.maintenanceDate && <span className="field-error">{errors.maintenanceDate}</span>}
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
                <label className="form-label">Total Cost (Rs.) <span className="required">*</span></label>
                <input id={`${ID}-input-cost`} className={`form-control${errors.totalMaintenanceCost ? ' input-error' : ''}`}
                  type="number" min="0" step="0.01" value={form.totalMaintenanceCost}
                  onChange={e => set('totalMaintenanceCost', e.target.value)} placeholder="0.00" />
                {errors.totalMaintenanceCost && <span className="field-error">{errors.totalMaintenanceCost}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select id={`${ID}-select-status`} className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </section>

          <hr className="divider" />

          {/* Section 3: Employee / Task Assignments (dynamic rows) */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="section-label" style={{ marginBottom: 0 }}>Task Assignments</p>
              <button id={`${ID}-btn-addDetail`} className="btn btn-secondary btn-sm" onClick={addDetail}>
                <Icon name="plus" style={{ width: 12, height: 12 }} /> Add Task
              </button>
            </div>

            {form.details.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No tasks assigned. Click "Add Task" to assign employees.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.details.map((d, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                    gap: 10, padding: '10px 12px',
                    background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', alignItems: 'end',
                  }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Employee</label>
                      <select id={`${ID}-detail-employee-${idx}`} className="form-control"
                        value={d.employeeID} onChange={e => setDetail(idx, 'employeeID', e.target.value)}>
                        <option value="">— Select —</option>
                        {MOCK.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Task Description</label>
                      <input id={`${ID}-detail-task-${idx}`} className="form-control"
                        value={d.taskDescription || ''} onChange={e => setDetail(idx, 'taskDescription', e.target.value)}
                        placeholder="e.g. Engine overhaul" />
                    </div>
                    <button id={`${ID}-btn-removeDetail-${idx}`} className="btn btn-danger btn-sm" onClick={() => removeDetail(idx)} style={{ height: 36 }}>
                      <Icon name="trash" style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <hr className="divider" />

          {/* Section 4: Cost Breakdown (dynamic rows) */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="section-label" style={{ marginBottom: 0 }}>Cost Breakdown</p>
              <button id={`${ID}-btn-addCost`} className="btn btn-secondary btn-sm" onClick={addCost}>
                <Icon name="plus" style={{ width: 12, height: 12 }} /> Add Cost
              </button>
            </div>

            {form.costs.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No cost records. Click "Add Cost" to add cost line items.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.costs.map((c, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                    gap: 10, padding: '10px 12px',
                    background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', alignItems: 'end',
                  }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Estimate Ref</label>
                      <input id={`${ID}-cost-estCode-${idx}`} className="form-control"
                        value={c.estimateCode || ''} onChange={e => setCost(idx, 'estimateCode', e.target.value)}
                        placeholder="e.g. EST-0001" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Cost (Rs.)</label>
                      <input id={`${ID}-cost-amount-${idx}`} className="form-control" type="number" min="0" step="0.01"
                        value={c.totalMaintenanceCost || ''} onChange={e => setCost(idx, 'totalMaintenanceCost', e.target.value)}
                        placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Date</label>
                      <input id={`${ID}-cost-date-${idx}`} className="form-control" type="date"
                        value={c.maintenanceDate || ''} onChange={e => setCost(idx, 'maintenanceDate', e.target.value)} />
                    </div>
                    <button id={`${ID}-btn-removeCost-${idx}`} className="btn btn-danger btn-sm" onClick={() => removeCost(idx)} style={{ height: 36 }}>
                      <Icon name="trash" style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <hr className="divider" />

          {/* ── Section 5: GL Asset Maintenance ── */}
          <section>
            <p className="section-label">GL Asset Maintenance</p>
            {!isEdit && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Save this record to begin the GL approval workflow.
              </p>
            )}
            <GLEffectPanel
              idPrefix={ID}
              transactionTypeCode="FA_ASSET_MAINT"
              fixedAssetTypeID={selectedAsset?.fixedAssetTypeID ?? null}
              fixedAssetCategoryID={selectedAsset?.fixedAssetCategoryID ?? null}
              amount={parseFloat(form.totalMaintenanceCost) || 0}
              glApprovalStatus={glState.GLApprovalStatus}
              glPostingRef={glState.GLPostingRef}
              glRejectionNote={glState.GLRejectionNote}
              isPostedToGL={glState.IsPostedToGL}
              {...glCallbacks}
            />
          </section>

        </div>

        {/* Footer */}
        <div className="card-footer">
          <button id={`${ID}-btn-cancel`} className="btn btn-secondary" onClick={() => navigate('/asset-maintenance')}>Cancel</button>
          <button id={`${ID}-btn-save`} className="btn btn-primary" onClick={handleSave}>
            <Icon name="check" /> {isEdit ? 'Update Record' : 'Save Maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}
