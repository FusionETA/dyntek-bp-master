// BP Master config (generated from Dyntek deal card, 33 Business Partner fields).
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
  },
  BP_FIELDS: [
  {
    "code": "UF_CRM_1681096198922",
    "label": "BP Master Code",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788927963390",
    "label": "Site Address",
    "type": "textarea"
  },
  {
    "code": "UF_CRM_1789094223984",
    "label": "Key person in charge",
    "type": "text"
  },
  {
    "code": "UF_CRM_1677052245834",
    "label": "Contact Number (Key person in charge)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789094271551",
    "label": "Email Address (Key person in charge)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1677574086",
    "label": "Accounts payable in charge",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789094331851",
    "label": "Contact Number (Accounts payable in charge)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789094351706",
    "label": "Email Address (Accounts payable in charge)",
    "type": "text"
  },
  {
    "code": "OPPORTUNITY_WITH_CURRENCY",
    "label": "Stiflex Potential Value (Amount)",
    "type": "opportunity"
  },
  {
    "code": "UF_CRM_64113317481F8",
    "label": "Est Meter",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789094768316",
    "label": "Duration in months",
    "type": "number"
  },
  {
    "code": "UF_CRM_1789095827364",
    "label": "Credit Limit",
    "type": "money"
  },
  {
    "code": "UF_CRM_1789095003595",
    "label": "Credit Term",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789095018604",
    "label": "Unit Discount Rate",
    "type": "number"
  },
  {
    "code": "UF_CRM_1789095051852",
    "label": "Project Discount (Effective)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1681095117227",
    "label": "Additional discount (or by Credit Note)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1681095611720",
    "label": "Technical Engineer",
    "type": "text"
  },
  {
    "code": "UF_CRM_1678069071426",
    "label": "Remarks",
    "type": "textarea"
  },
  {
    "code": "UF_CRM_1788927944237",
    "label": "FSC02 Requirement (COC Type 2)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928066163",
    "label": "Delivery",
    "type": "select",
    "options": [
      {
        "id": "3287",
        "value": "Side Curtain Truck"
      },
      {
        "id": "3289",
        "value": "Open Trailer"
      },
      {
        "id": "3291",
        "value": "Small lorry"
      }
    ]
  },
  {
    "code": "UF_CRM_1788927985341",
    "label": "Materials Receiving Person",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789095338628",
    "label": "Contact (Materials Receiving Person)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789095353875",
    "label": "Alternative Receiving Person",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789095366424",
    "label": "Contact (Alternative Receiving Person)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928099629",
    "label": "Delivery Timing Limitation (if any)",
    "type": "text"
  },
  {
    "code": "UF_CRM_1789095454425",
    "label": "Picture of delivery gate / Road map delivery gate",
    "type": "file",
    "multiple": true
  },
  {
    "code": "UF_CRM_1788928261709",
    "label": "Type of Project",
    "type": "select",
    "options": [
      {
        "id": "3293",
        "value": "Commercial"
      },
      {
        "id": "3295",
        "value": "Residential"
      },
      {
        "id": "3297",
        "value": "Institutional / Education"
      },
      {
        "id": "3299",
        "value": "Healthcare"
      },
      {
        "id": "3301",
        "value": "Hospitality"
      },
      {
        "id": "3303",
        "value": "Industrial"
      },
      {
        "id": "3305",
        "value": "Infrastructure"
      },
      {
        "id": "3307",
        "value": "Others"
      }
    ]
  },
  {
    "code": "UF_CRM_1788928278997",
    "label": "Main Contractor",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928290685",
    "label": "Architect",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928306904",
    "label": "Consultant",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928320576",
    "label": "Product Type",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928336635",
    "label": "Estimate Year of Completion",
    "type": "text"
  },
  {
    "code": "UF_CRM_1788928407186",
    "label": "Type of Wall",
    "type": "select",
    "options": [
      {
        "id": "3309",
        "value": "Concrete Panel"
      },
      {
        "id": "3311",
        "value": "Concrete Block"
      },
      {
        "id": "3313",
        "value": "AAC Panel"
      },
      {
        "id": "3315",
        "value": "AAC Block"
      },
      {
        "id": "3317",
        "value": "Clay Brick"
      }
    ]
  }
],
};
