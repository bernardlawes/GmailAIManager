/***************************************************************
 * GMAIL AI MANAGER - LABEL TAXONOMIES
 *
 * Each Gmail installation selects one taxonomy profile:
 *
 *   MAIN   - Full personal taxonomy
 *   WORK   - Work-only taxonomy
 *   SIMPLE - Lightweight taxonomy
 *
 * No email addresses are associated with profiles.
 ***************************************************************/


/***************************************************************
 * ACCOUNT PROFILE
 *
 * Change ONLY this value when configuring an installation:
 *
 *   'MAIN'
 *   'WORK'
 *   'SIMPLE'
 ***************************************************************/

const GMAIL_AI_ACCOUNT_TYPE = GMAIL_AI_CONFIG.accountType;


/***************************************************************
 * TAXONOMIES
 ***************************************************************/

const GMAIL_AI_TAXONOMIES = {

  MAIN: [

    // ACTION
    'ACTION',
    'ACTION/Reply',
    'ACTION/To Do',
    'ACTION/Waiting',

    // CAREER
    'CAREER',
    'CAREER/Job Search',
    'CAREER/Employer',

    // FINANCIAL
    'FINANCIAL',
    'FINANCIAL/Banking',
    'FINANCIAL/Credit Card',
    'FINANCIAL/Income',
    'FINANCIAL/Investments',
    'FINANCIAL/Philanthropy',

    // RECEIPTS
    'RECEIPTS',
    'RECEIPTS/PayApps',
    'RECEIPTS/Food',
    'RECEIPTS/Shopping',
    'RECEIPTS/Rent',
    'RECEIPTS/Vehicle',
    'RECEIPTS/Commute',
    'RECEIPTS/Travel',
    'RECEIPTS/Utilities',
    'RECEIPTS/Technology',

    // RECORDS
    'RECORDS',
    'RECORDS/Government',
    'RECORDS/Postal',
    'RECORDS/Tax',
    'RECORDS/Legal',
    'RECORDS/Legal/Claims',
    'RECORDS/Legal/Contracts',
    'RECORDS/Legal/Disputes',

    // MEDICAL
    'MEDICAL',

    // PET
    'PET',
    'PET/Veterinary',
    'PET/Supplies and Food',
    'PET/Nutrition',

    // LEARN
    'LEARN',
    'LEARN/Newsletters',
    'LEARN/Research',

    // WORK
    'WORK',
    'WORK/Clients',
    'WORK/Projects',

    // PERSONAL
    'PERSONAL'

  ],


  WORK: [

    'WORK',
    'WORK/Clients',
    'WORK/Projects'

  ],


  SIMPLE: [

    'Newsletters',
    'Receipts',
    'Shopping',
    'Personal',
    'Action'

  ]

};


/***************************************************************
 * GET ACTIVE TAXONOMY
 ***************************************************************/

function getAllowedGmailAILabels() {

  const labels =
    GMAIL_AI_TAXONOMIES[
      GMAIL_AI_ACCOUNT_TYPE
    ];

  if (!labels) {
    throw new Error(
      `Unknown Gmail AI account type: ${GMAIL_AI_ACCOUNT_TYPE}`
    );
  }

  return labels.slice();

}


/***************************************************************
 * CHECK ONE LABEL
 ***************************************************************/

function isAllowedGmailAILabel(labelName) {

  if (
    typeof labelName !== 'string' ||
    !labelName.trim()
  ) {
    return false;
  }

  return getAllowedGmailAILabels()
    .includes(labelName.trim());

}


/***************************************************************
 * VALIDATE LABEL ARRAY
 ***************************************************************/

function validateGmailAILabels(labels) {

  if (!Array.isArray(labels)) {
    throw new Error(
      'labels must be an array.'
    );
  }

  const normalized = [];

  for (const label of labels) {

    if (
      typeof label !== 'string' ||
      !label.trim()
    ) {
      throw new Error(
        'Each label must be a non-empty string.'
      );
    }

    const cleanLabel =
      label.trim();

    if (
      !isAllowedGmailAILabel(
        cleanLabel
      )
    ) {
      throw new Error(
        `Label is not allowed for ${GMAIL_AI_ACCOUNT_TYPE}: ${cleanLabel}`
      );
    }

    if (
      !normalized.includes(
        cleanLabel
      )
    ) {
      normalized.push(
        cleanLabel
      );
    }

  }

  return normalized;

}


/***************************************************************
 * CREATE MISSING LABELS FOR ACTIVE PROFILE
 *
 * Manual administrative function.
 *
 * Creates missing canonical labels only.
 * Existing Gmail labels are untouched.
 * Nothing is deleted or renamed.
 ***************************************************************/

function setupCanonicalLabels() {

  const allowedLabels =
    getAllowedGmailAILabels();

  const response =
    Gmail.Users.Labels.list('me');

  const existingNames =
    new Set(
      (response.labels || [])
        .map(label => label.name)
    );


  const createdLabels = [];
  const existingLabels = [];


  for (
    const labelName of
    allowedLabels
  ) {

    if (
      existingNames.has(labelName)
    ) {

      existingLabels.push(
        labelName
      );

      console.log(
        `EXISTS: ${labelName}`
      );

      continue;

    }


    Gmail.Users.Labels.create(
      {
        name: labelName,
        labelListVisibility:
          'labelShow',
        messageListVisibility:
          'show'
      },
      'me'
    );


    createdLabels.push(
      labelName
    );

    console.log(
      `CREATED: ${labelName}`
    );

  }


  const result = {

    success: true,

    accountType:
      GMAIL_AI_ACCOUNT_TYPE,

    canonical:
      allowedLabels.length,

    existing:
      existingLabels.length,

    created:
      createdLabels.length,

    existingLabels:
      existingLabels,

    createdLabels:
      createdLabels

  };


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/***************************************************************
 * SAFE VALIDATION TEST
 *
 * Read-only. Does not modify Gmail.
 ***************************************************************/

function testLabelValidation() {

  console.log(
    'ACCOUNT TYPE: ' +
    GMAIL_AI_ACCOUNT_TYPE
  );

  console.log(
    JSON.stringify(
      getAllowedGmailAILabels(),
      null,
      2
    )
  );


  const valid =
    validateGmailAILabels([
      'Newsletters',
      'Receipts'
    ]);

  console.log(
    'VALID: ' +
    JSON.stringify(valid)
  );


  try {

    validateGmailAILabels([
      'LEARN/Newsletters'
    ]);

  } catch (error) {

    console.log(
      'EXPECTED ERROR: ' +
      error.message
    );

  }

}

function testListRelevantLabels() {

  const response =
    Gmail.Users.Labels.list('me');

  const labels =
    response.labels || [];

  for (const label of labels) {

    const name =
      label.name || '';

    if (
      /newsletter|receipt|shopping|personal|action/i.test(name)
    ) {
      console.log(
        JSON.stringify({
          id: label.id,
          name: name,
          type: label.type
        })
      );
    }

  }

}