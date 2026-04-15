import { MOCK } from '../data/mockData';

/**
 * Reusable Group → Estate selector pair.
 * Used at the top of every Add / Edit form that requires Group + Estate scope.
 *
 * Props:
 *   groupID   – current group value (string or number)
 *   estateID  – current estate value (string or number)
 *   onChange  – fn(key, value) setter — must handle 'groupID' and 'estateID'
 *   errors    – { groupID?, estateID? } validation error strings
 *   idPrefix  – prefix for QA automation IDs (e.g. "fat" → fat-select-group, fat-select-estate)
 */
export function GroupEstateFields({ groupID, estateID, onChange, errors = {}, idPrefix = 'form' }) {
  const filteredEstates = groupID
    ? MOCK.estates.filter(e => e.groupID === Number(groupID))
    : [];

  const handleGroupChange = (val) => {
    onChange('groupID', val);
    onChange('estateID', '');   // reset estate whenever group changes
  };

  return (
    <div className="form-grid form-grid-2">
      {/* Group */}
      <div className="form-group">
        <label className="form-label">
          Group <span className="required">*</span>
        </label>
        <select
          id={`${idPrefix}-select-group`}
          className={`form-control${errors.groupID ? ' input-error' : ''}`}
          value={groupID}
          onChange={e => handleGroupChange(e.target.value)}
        >
          <option value="">— Select Group —</option>
          {MOCK.groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        {errors.groupID && <span className="field-error">{errors.groupID}</span>}
      </div>

      {/* Estate — disabled until Group chosen */}
      <div className="form-group">
        <label className="form-label">
          Estate <span className="required">*</span>
        </label>
        <select
          id={`${idPrefix}-select-estate`}
          className={`form-control${errors.estateID ? ' input-error' : ''}`}
          value={estateID}
          onChange={e => onChange('estateID', e.target.value)}
          disabled={!groupID}
        >
          <option value="">
            {groupID ? '— Select Estate —' : '— Select Group first —'}
          </option>
          {filteredEstates.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        {errors.estateID && <span className="field-error">{errors.estateID}</span>}
      </div>
    </div>
  );
}
