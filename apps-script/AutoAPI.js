/**
 * AUTO rules
 *
 * Persistent deterministic rules for known senders.
 *
 * Sheet:
 *   AUTO
 *
 * Columns:
 *   SENDER | LABEL | ARCHIVE
 *
 * Example:
 *   techpresso@dupple.com | Newsletters | TRUE
 *
 * This file manages AUTO rules only.
 * It does not execute them against Gmail yet.
 */

const AUTO_SHEET_NAME = 'AUTO';


/**
 * Return all configured AUTO rules.
 */
function getAutoRules() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(AUTO_SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'Missing sheet: ' + AUTO_SHEET_NAME
    );
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values =
    sheet
      .getRange(2, 1, lastRow - 1, 3)
      .getValues();

  const rules = [];

  for (const row of values) {

    const sender =
      String(row[0] || '').trim();

    const label =
      String(row[1] || '').trim();

    const archive =
      row[2] === true ||
      String(row[2]).toUpperCase() === 'TRUE';

    if (!sender && !label) {
      continue;
    }

    if (!sender) {
      throw new Error(
        'AUTO rule is missing SENDER.'
      );
    }

    if (!label) {
      throw new Error(
        'AUTO rule for ' +
        sender +
        ' is missing LABEL.'
      );
    }

    validateAutoSender(sender);
    validateGmailAILabels([label]);

    rules.push({
      sender: sender,
      label: label,
      archive: archive
    });
  }

  return rules;
}


/**
 * Add one persistent AUTO rule.
 */
function addAutoRule(sender, label, archive) {

  sender =
    String(sender || '').trim();

  label =
    String(label || '').trim();

  if (typeof archive !== 'boolean') {
    throw new Error(
      'AUTO archive must be true or false.'
    );
  }

  validateAutoSender(sender);

  const validatedLabels =
    validateGmailAILabels([label]);

  label = validatedLabels[0];

  const existing =
    getAutoRules();

  for (const rule of existing) {

    if (
      rule.sender.toLowerCase() ===
      sender.toLowerCase()
    ) {

      throw new Error(
        'AUTO rule already exists for sender: ' +
        sender
      );
    }
  }

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(AUTO_SHEET_NAME);

  sheet.appendRow([
    sender,
    label,
    archive
  ]);

  return {
    success: true,
    operation: 'add',
    rule: {
      sender: sender,
      label: label,
      archive: archive
    }
  };
}


/**
 * Remove the AUTO rule for one sender.
 */
function removeAutoRule(sender) {

  sender =
    String(sender || '').trim();

  validateAutoSender(sender);

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(AUTO_SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'Missing sheet: ' + AUTO_SHEET_NAME
    );
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: true,
      operation: 'remove',
      sender: sender,
      removed: false
    };
  }

  const values =
    sheet
      .getRange(2, 1, lastRow - 1, 3)
      .getValues();

  for (let i = 0; i < values.length; i++) {

    const existingSender =
      String(values[i][0] || '').trim();

    if (
      existingSender.toLowerCase() ===
      sender.toLowerCase()
    ) {

      sheet.deleteRow(i + 2);

      return {
        success: true,
        operation: 'remove',
        sender: sender,
        removed: true
      };
    }
  }

  return {
    success: true,
    operation: 'remove',
    sender: sender,
    removed: false
  };
}


/**
 * Validate sender syntax.
 *
 * AUTO v1 deliberately supports exact sender
 * email addresses only, not domains.
 */
function validateAutoSender(sender) {

  if (
    typeof sender !== 'string' ||
    !sender.trim()
  ) {
    throw new Error(
      'AUTO sender must be a non-empty email address.'
    );
  }

  const value =
    sender.trim();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(value)) {
    throw new Error(
      'AUTO sender must be an exact email address: ' +
      value
    );
  }

  return value;
}


/**
 * Read-only test.
 */
function testGetAutoRules() {

  const result =
    getAutoRules();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}


/**
 * Controlled add/remove test.
 *
 * Uses a fake sender and leaves the AUTO sheet
 * unchanged when complete.
 */
function testAutoRuleManagement() {

  const sender =
    'gmail-ai-test@example.com';

  const label =
    getAllowedGmailAILabels()[0];

  console.log(
    JSON.stringify(
      addAutoRule(
        sender,
        label,
        true
      ),
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      getAutoRules(),
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      removeAutoRule(sender),
      null,
      2
    )
  );
}

/**
 * Execute all configured AUTO rules against
 * matching messages currently in the Inbox.
 *
 * Deterministic:
 *   exact sender -> configured label
 *   optionally remove INBOX
 */
function runAutoRules() {

  const rules =
    getAutoRules();

  if (rules.length === 0) {
    return {
      success: true,
      rules: 0,
      matched: 0,
      labeled: 0,
      archived: 0
    };
  }

  // Resolve Gmail label names to IDs once.
  const labelResponse =
    Gmail.Users.Labels.list('me');

  const labelIdsByName = {};

  for (const label of (labelResponse.labels || [])) {
    labelIdsByName[label.name] = label.id;
  }

  // Validate every configured label before
  // modifying any Gmail messages.
  for (const rule of rules) {

    if (!labelIdsByName[rule.label]) {
      throw new Error(
        'Gmail label does not exist: ' +
        rule.label
      );
    }
  }

  let matched = 0;
  let labeled = 0;
  let archived = 0;

  for (const rule of rules) {

    // Exact sender rule, Inbox only.
    const query =
      'in:inbox from:(' +
      rule.sender +
      ')';

    const messageIds =
      searchGmailIds(query);

    matched += messageIds.length;

    if (messageIds.length === 0) {
      continue;
    }

    const addLabelIds = [
      labelIdsByName[rule.label]
    ];

    const removeLabelIds =
      rule.archive
        ? ['INBOX']
        : [];

    Gmail.Users.Messages.batchModify(
      {
        ids: messageIds,
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds
      },
      'me'
    );

    labeled += messageIds.length;

    if (rule.archive) {
      archived += messageIds.length;
    }
  }

  return {
    success: true,
    rules: rules.length,
    matched: matched,
    labeled: labeled,
    archived: archived
  };
}


function runAutoRulesForRules(rules) {

  if (!Array.isArray(rules)) {
    throw new Error(
      'AUTO rules must be an array.'
    );
  }

  if (rules.length === 0) {
    return {
      success: true,
      rules: 0,
      matched: 0,
      labeled: 0,
      archived: 0
    };
  }

  /*
   * Validate the supplied rules before
   * modifying any Gmail messages.
   */
  for (const rule of rules) {

    validateAutoSender(rule.sender);

    validateGmailAILabels([
      rule.label
    ]);

    if (typeof rule.archive !== 'boolean') {
      throw new Error(
        'AUTO archive must be true or false.'
      );
    }
  }

  /*
   * Resolve Gmail label names to IDs.
   */
  const labelResponse =
    Gmail.Users.Labels.list('me');

  const labelIdsByName = {};

  for (const label of (labelResponse.labels || [])) {
    labelIdsByName[label.name] = label.id;
  }

  /*
   * Confirm every required Gmail label exists
   * before changing any messages.
   */
  for (const rule of rules) {

    if (!labelIdsByName[rule.label]) {
      throw new Error(
        'Gmail label does not exist: ' +
        rule.label
      );
    }
  }

  let matched = 0;
  let labeled = 0;
  let archived = 0;

  for (const rule of rules) {

    const query =
      'in:inbox from:(' +
      rule.sender +
      ')';

    const messageIds =
      searchGmailIds(query);

    matched += messageIds.length;

    if (messageIds.length === 0) {
      continue;
    }

    const addLabelIds = [
      labelIdsByName[rule.label]
    ];

    const removeLabelIds =
      rule.archive
        ? ['INBOX']
        : [];

    Gmail.Users.Messages.batchModify(
      {
        ids: messageIds,
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds
      },
      'me'
    );

    labeled += messageIds.length;

    if (rule.archive) {
      archived += messageIds.length;
    }
  }

  return {
    success: true,
    rules: rules.length,
    matched: matched,
    labeled: labeled,
    archived: archived
  };
}


/**
 * Manual executor test.
 *
 * Runs the currently configured AUTO rules.
 */
function testRunAutoRules() {

  const result =
    runAutoRules();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

/**
 * Apply approved AUTO rule changes.
 *
 * All requested changes are validated before
 * modifying the AUTO sheet.
 */
function applyAutoRuleChanges(changes) {

  if (
    !changes ||
    typeof changes !== 'object' ||
    Array.isArray(changes)
  ) {
    throw new Error(
      'AUTO changes must be an object.'
    );
  }

  const add =
    changes.add || [];

  const remove =
    changes.remove || [];

  if (!Array.isArray(add)) {
    throw new Error(
      'AUTO add must be an array.'
    );
  }

  if (!Array.isArray(remove)) {
    throw new Error(
      'AUTO remove must be an array.'
    );
  }

  /*
   * Validate everything before changing
   * the source-of-truth sheet.
   */
  for (const rule of add) {

    if (
      !rule ||
      typeof rule !== 'object' ||
      Array.isArray(rule)
    ) {
      throw new Error(
        'Each AUTO add rule must be an object.'
      );
    }

    validateAutoSender(rule.sender);

    validateGmailAILabels([
      rule.label
    ]);

    if (typeof rule.archive !== 'boolean') {
      throw new Error(
        'AUTO archive must be true or false.'
      );
    }
  }

  for (const sender of remove) {
    validateAutoSender(sender);
  }

  /*
   * Prevent duplicate sender rules within
   * the same request.
   */
  const seen = {};

  for (const rule of add) {

    const key =
      rule.sender
        .trim()
        .toLowerCase();

    if (seen[key]) {
      throw new Error(
        'Duplicate AUTO sender in request: ' +
        rule.sender
      );
    }

    seen[key] = true;
  }

  const results = [];

  /*
   * Remove first so an approved replacement
   * can remove and then re-add the sender.
   */
  for (const sender of remove) {

    results.push(
      removeAutoRule(sender)
    );
  }

  for (const rule of add) {

    results.push(
      addAutoRule(
        rule.sender,
        rule.label,
        rule.archive
      )
    );
  }

  /*
  * Synchronize the complete AUTO rule set into
  * native Gmail filters for future messages.
  */
  const filterSync =
    syncLabeledFilters();

  /*
  * Process existing Inbox messages only for
  * AUTO rules added by THIS request.
  *
  * Existing AUTO rules do not need to be
  * searched again.
  */
  const execution =
    runAutoRulesForRules(add);

  return {
    success: true,
    changes: results,
    filterSync: filterSync,
    execution: execution
  };
  
}



function testApplyAutoRuleChanges() {

  const result =
    applyAutoRuleChanges({
      add: [],
      remove: []
    });

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

/**
 * Install the periodic AUTO-rule executor.
 *
 * Replaces any existing runAutoRules trigger
 * so exactly one hourly trigger exists.
 */
function installAutoTrigger() {

  const functionName = 'runAutoRules';

  // Remove existing AUTO triggers.
  const triggers =
    ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {

    if (
      trigger.getHandlerFunction() ===
      functionName
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create exactly one hourly trigger.
  ScriptApp
    .newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();

  return {
    success: true,
    created: true,
    intervalHours: 1
  };
}


function testInstallAutoTrigger() {

  const result =
    installAutoTrigger();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

function testApplyAutoRuleChangesEmpty() {

  const result =
    applyAutoRuleChanges({
      add: [],
      remove: []
    });

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

function removeAutoTrigger() {

  const triggers =
    ScriptApp.getProjectTriggers();

  let removed = 0;

  for (const trigger of triggers) {

    if (
      trigger.getHandlerFunction() ===
      'runAutoRules'
    ) {

      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }

  return {
    success: true,
    removed: removed
  };
}


function testRemoveAutoTrigger() {

  console.log(
    JSON.stringify(
      removeAutoTrigger(),
      null,
      2
    )
  );
}