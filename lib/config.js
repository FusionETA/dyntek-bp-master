// BP Master config. Fields are grouped into two sections (Project / Business
// Partner) and rendered in array order. Field flags:
//   section:    'project' | 'bp'  (which group it shows under)
//   readOnly:   true -> always disabled (deal-derived or auto-generated)
//   required:   true -> marked * ; the plain ones are enforced by Bitrix's
//               native "required to move to stage" gate at Confirm Purchase
//   showWhen:   { field, is } -> only visible when that select == that enum id;
//               a shown field that is `required` is enforced on save in the tab
//               (this is how the conditional Yes/No sub-fields work)
//   computed:   { pctOf, pct } -> read-only value = pctOf * pct / 100
export const CONFIG = {
  DOMAIN: 'dyntek.bitrix24.com',
  ACCOUNT_OPEN_STATUS_ID: 'UC_ACCTOP', // lock applies at this stage and onwards
  ALWAYS_EDIT_USER_IDS: [19, 5],

  // Auto-numbering: when a deal enters this stage (in this pipeline category),
  // assign a BP Master Code (P#####) to the deal and a Company Code (C#####) to
  // its company, each once. The registry List is the editable source of truth.
  NUMBERING: {
    TRIGGER_STATUS_ID: 'UC_C6PH91', // "Confirm Purchase"
    CATEGORY_ID: 0,                 // main deal pipeline
    REGISTRY_IBLOCK_ID: 49,         // Lists > "Code Registry"
    PAD: 5,                         // zero-pad width -> P00001 / C00001
    DEAL_CODE_FIELD: 'UF_CRM_1681096198922', // BP Master Code (deal)
    DEAL_PREFIX: 'P',
    COMPANY_CODE_FIELD: 'UF_CRM_COMPANY_CODE', // Company Code (company)
    COMPANY_PREFIX: 'C',
    // Code Registry list columns (list 49). Row NAME holds the code; these
    // properties record what each code was assigned to, for management.
    REGISTRY_PROPS: {
      ASSIGNED_TO: 'PROPERTY_239', // "Deal #8241 — Title" / "Company #… — Title"
      ENTITY: 'PROPERTY_241',      // "Deal" | "Company"
      ENTITY_ID: 'PROPERTY_243',   // numeric id
      ASSIGNED_AT: 'PROPERTY_245', // YYYY-MM-DD
    },
    DEBUG: false, // set true to log each /api/event hit (+ list probe) to the deal timeline
  },

  SECTION_LABELS: { project: 'Project', bp: 'Business Partner' },

  BP_FIELDS: [
    // ---------------- PROJECT ----------------
    { code: '__COMPANY__', label: 'Company', type: 'companyName', section: 'project', readOnly: true },
    { code: '__PROJECT__', label: 'Project', type: 'dealTitle', section: 'project', readOnly: true },
    { code: 'UF_CRM_1788927963390', label: 'Site Address', type: 'textarea', section: 'project', required: true },
    { code: 'UF_CRM_1788927985341', label: 'Material Receiving Person', type: 'text', section: 'project', required: true },
    { code: 'UF_CRM_1789095338628', label: 'Contact (Materials Receiving Person)', type: 'text', section: 'project', required: true },
    { code: 'UF_CRM_1789095353875', label: 'Alternative Receiving Person', type: 'text', section: 'project', required: true },
    { code: 'UF_CRM_1789095366424', label: 'Contact (Alternative Receiving Person)', type: 'text', section: 'project', required: true },
    { code: 'UF_CRM_1788928066163', label: 'Delivery', type: 'select', section: 'project', required: true, options: [
      { id: '3287', value: 'Side Curtain Truck' }, { id: '3289', value: 'Open Trailer' }, { id: '3291', value: 'Small lorry' },
    ] },
    { code: 'UF_CRM_1788928099629', label: 'Delivery Timing Limitation (if any)', type: 'text', section: 'project', required: true },
    { code: 'UF_CRM_1789095454425', label: 'Picture of delivery gate / Road map delivery gate', type: 'file', section: 'project', multiple: true },
    { code: 'UF_CRM_1788928261709', label: 'Type of Project', type: 'select', section: 'project', options: [
      { id: '3293', value: 'Commercial' }, { id: '3295', value: 'Residential' }, { id: '3297', value: 'Institutional / Education' },
      { id: '3299', value: 'Healthcare' }, { id: '3301', value: 'Hospitality' }, { id: '3303', value: 'Industrial' },
      { id: '3305', value: 'Infrastructure' }, { id: '3307', value: 'Others' },
    ] },
    { code: 'UF_CRM_1788928278997', label: 'Main Contractor', type: 'text', section: 'project' },
    { code: 'UF_CRM_1788928290685', label: 'Architect', type: 'text', section: 'project' },
    { code: 'UF_CRM_1788928306904', label: 'Consultant', type: 'text', section: 'project' },
    { code: 'UF_CRM_1788928320576', label: 'Product Type', type: 'text', section: 'project' },
    { code: 'UF_CRM_1788928336635', label: 'Estimate Year of Completion', type: 'text', section: 'project' },
    { code: 'UF_CRM_1788928407186', label: 'Type of Wall', type: 'select', section: 'project', options: [
      { id: '3309', value: 'Concrete Panel' }, { id: '3311', value: 'Concrete Block' }, { id: '3313', value: 'AAC Panel' },
      { id: '3315', value: 'AAC Block' }, { id: '3317', value: 'Clay Brick' },
    ] },

    // ---------------- BUSINESS PARTNER ----------------
    { code: '__COMPANY__', label: 'Company', type: 'companyName', section: 'bp', readOnly: true },
    { code: '__PROJECT__', label: 'Project', type: 'dealTitle', section: 'bp', readOnly: true },
    { code: 'UF_CRM_1681096198922', label: 'BP Master Code', type: 'text', section: 'bp', readOnly: true },

    { code: 'UF_CRM_1789094223984', label: 'Key Person In Charge', type: 'text', section: 'bp', required: true },
    { code: 'UF_CRM_1677052245834', label: 'Contact (Key Person In Charge)', type: 'text', section: 'bp', required: true },
    { code: 'UF_CRM_1789094271551', label: 'Email Address (Key Person In Charge)', type: 'text', section: 'bp', required: true },
    { code: 'UF_CRM_1677574086', label: 'Accounts Payable In Charge', type: 'text', section: 'bp', required: true },
    { code: 'UF_CRM_1789094331851', label: 'Contact (Accounts Payable In Charge)', type: 'text', section: 'bp', required: true },
    { code: 'UF_CRM_1789094351706', label: 'Email Address (Accounts Payable In Charge)', type: 'text', section: 'bp', required: true },

    { code: 'OPPORTUNITY_WITH_CURRENCY', label: 'Estimated / Contracted Project Value', type: 'opportunity', section: 'bp', required: true },
    { code: 'UF_CRM_BP_VCAP', label: 'Value Cap (%)', type: 'number', section: 'bp', default: 85 },
    { code: 'UF_CRM_BP_CAPVAL', label: 'Cap Value', type: 'number', section: 'bp', readOnly: true, computed: { pctOf: 'OPPORTUNITY_WITH_CURRENCY', pct: 'UF_CRM_BP_VCAP' } },
    { code: 'UF_CRM_64113317481F8', label: 'Est Meter', type: 'text', section: 'bp' },
    { code: 'UF_CRM_1789094768316', label: 'Duration in months', type: 'number', section: 'bp' },

    { code: 'UF_CRM_BP_CREDITREQ', label: 'Credit Term Request', type: 'select', section: 'bp', required: true, options: [
      { id: '3393', value: 'Yes' }, { id: '3395', value: 'No' },
    ] },
    { code: 'UF_CRM_1789095827364', label: 'Credit Limit', type: 'money', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },
    { code: 'UF_CRM_1789095003595', label: 'Credit Term', type: 'text', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },
    { code: 'UF_CRM_BP_DOC_FS', label: 'Audited FS', type: 'file', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },
    { code: 'UF_CRM_BP_DOC_CAF', label: 'CAF', type: 'file', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },
    { code: 'UF_CRM_BP_DOC_SSM', label: 'SSM / ACRA / Registration Cert', type: 'file', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },
    { code: 'UF_CRM_BP_DOC_BANK', label: 'Bank Statement', type: 'file', section: 'bp', showWhen: { field: 'UF_CRM_BP_CREDITREQ', is: '3393' }, required: true },

    { code: 'UF_CRM_1789095018604', label: 'Unit Discount Rate', type: 'number', section: 'bp', required: true },
    { code: 'UF_CRM_1789095051852', label: 'Project Discount Rate (lump-sum)', type: 'text', section: 'bp' },
    { code: 'UF_CRM_1681095611720', label: 'Technical Engineer', type: 'text', section: 'bp' },

    { code: 'UF_CRM_BP_FSC02', label: 'FSC02 Requirement (COC Type 2)', type: 'select', section: 'bp', required: true, options: [
      { id: '3397', value: 'Yes' }, { id: '3399', value: 'No' },
    ] },
    { code: 'UF_CRM_BP_FSCAMT', label: 'FSC02 Billing Amount', type: 'number', section: 'bp', showWhen: { field: 'UF_CRM_BP_FSC02', is: '3397' }, required: true },
    { code: 'UF_CRM_BP_BOQ', label: 'Bill of Quantity', type: 'file', section: 'bp' },

    { code: 'UF_CRM_BP_SPEC', label: 'Special Item', type: 'select', section: 'bp', required: true, options: [
      { id: '3401', value: 'Yes' }, { id: '3403', value: 'No' },
    ] },
    { code: 'UF_CRM_BP_SPECDOC', label: 'Special Item List', type: 'file', section: 'bp', showWhen: { field: 'UF_CRM_BP_SPEC', is: '3401' }, required: true },

    // Existing fields kept for continuity (not in the new spec layout).
    { code: 'UF_CRM_1681095117227', label: 'Additional discount (or by Credit Note)', type: 'text', section: 'bp' },
    { code: 'UF_CRM_1678069071426', label: 'Remarks', type: 'textarea', section: 'bp' },
  ],
};
