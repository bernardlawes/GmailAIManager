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

function getGmailAIAccountType() {

  return getGmailAIConfig().accountType;

}


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

    // COMPANY
    'COMPANY',
    'COMPANY/Projects',
    'COMPANY/Operations',
    'COMPANY/Income',
    'COMPANY/Expenses',
    'COMPANY/Services',
    'COMPANY/IP',

    // CLIENTS
    'CLIENTS',
    'CLIENTS/_Job Search',
    'CLIENTS/Client A',
    'CLIENTS/Client B',
    'CLIENTS/Client C',

    // FINANCIAL
    'FINANCIAL',
    'FINANCIAL/Advisor',
    'FINANCIAL/Banking',
    'FINANCIAL/Credit Card',
    'FINANCIAL/Insurance',
    'FINANCIAL/Monitoring',
    'FINANCIAL/Income',
    'FINANCIAL/Investments',
    'FINANCIAL/Philanthropy',

    // RECEIPTS
    'RECEIPTS',
    'RECEIPTS/PayApps',
    'RECEIPTS/Food',
    'RECEIPTS/Shopping',
    'RECEIPTS/Housing',
    'RECEIPTS/Vehicle',
    'RECEIPTS/Travel',
    'RECEIPTS/Utilities',

    // RECORDS
    'RECORDS',
    'RECORDS/Government',
    'RECORDS/Postal',
    'RECORDS/Tax',
    'RECORDS/Legal',
    'RECORDS/Legal/Contracts',
    'RECORDS/Legal/Claims',

    // HEALTH
    'HEALTH',
    'HEALTH/Records',
    'HEALTH/Invoices',

    // PET
    'PET',
    'PET/Veterinary',
    'PET/Insurance',
    'PET/Supplies',
    'PET/Nutrition',
    'PET/Lali',

    // LEARN
    'LEARN',
    'LEARN/Bible',
    'LEARN/AI',
    'LEARN/Politics',
    'LEARN/Vision AI',
    'LEARN/Trading',
    'LEARN/Infographics',

    // PERSONAL
    'PERSONAL',
    'PERSONAL/Mom',

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
      getGmailAIAccountType()
    ];

  if (!labels) {
    throw new Error(
      `Unknown Gmail AI account type: ${getGmailAIAccountType()}`
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
        `Label is not allowed for ${getGmailAIAccountType()}: ${cleanLabel}`
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
      getGmailAIAccountType(),

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

  const accountType =
    getGmailAIAccountType();

  const allowedLabels =
    getAllowedGmailAILabels();

  console.log(
    'ACCOUNT TYPE: ' +
    accountType
  );

  console.log(
    JSON.stringify(
      allowedLabels,
      null,
      2
    )
  );


  /*
   * Verify that labels from the active taxonomy
   * are accepted.
   */

  const testLabels =
    allowedLabels.slice(
      0,
      Math.min(2, allowedLabels.length)
    );

  const valid =
    validateGmailAILabels(
      testLabels
    );

  console.log(
    'VALID: ' +
    JSON.stringify(valid)
  );


  /*
   * Verify that a label outside every canonical
   * taxonomy is rejected.
   */

  try {

    validateGmailAILabels([
      '__INVALID_TEST_LABEL__'
    ]);

    throw new Error(
      'Validation failed to reject an invalid label.'
    );

  } catch (error) {

    if (
      error.message ===
      'Validation failed to reject an invalid label.'
    ) {
      throw error;
    }

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