/***************************************************************
 * GMAIL CLEANUP MANAGER - Goal #2
 *
 * AI / COMMAND INTERFACE
 *
 * These functions modify the source-of-truth Sheets.
 * They DO NOT implement Gmail logic.
 *
 * Gmail behavior remains controlled by sync().
 ***************************************************************/


/***************************************************************
 * PUBLIC COMMANDS
 ***************************************************************/

function addDelete(value) {
  return addRuleToSheet('DELETE', value);
}


function removeDelete(value) {
  return removeRuleFromSheet('DELETE', value);
}


function addProtected(value) {
  return addRuleToSheet('PROTECTED', value);
}


function removeProtected(value) {
  return removeRuleFromSheet('PROTECTED', value);
}


/***************************************************************
 * ADD RULE
 ***************************************************************/

function addRuleToSheet(sheetName, value) {

  const normalized =
    normalizeRuleInput(value);

  if (!normalized.valid) {
    throw new Error(
      `Invalid sender/domain: ${value}`
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(sheetName);


  if (!sheet) {
    throw new Error(
      `${sheetName} sheet not found.`
    );
  }


  /*************************************************************
   * CHECK FOR EXISTING RULE
   *************************************************************/

  const lastRow =
    sheet.getLastRow();


  if (lastRow >= 2) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          2
        )
        .getValues();


    for (
      let i = 0;
      i < values.length;
      i++
    ) {

      const existing =
        normalizeRuleInput(
          values[i][0]
        );


      if (
        existing.valid &&
        existing.value === normalized.value
      ) {

        /*
         * Rule already exists.
         *
         * If disabled, re-enable it.
         */

        if (values[i][1] !== true) {

          sheet
            .getRange(i + 2, 2)
            .setValue(true);


          return {
            success: true,
            action: 'REENABLED',
            list: sheetName,
            value: normalized.value
          };

        }


        return {
          success: true,
          action: 'ALREADY_EXISTS',
          list: sheetName,
          value: normalized.value
        };

      }

    }

  }


  /*************************************************************
   * ADD NEW ROW
   *************************************************************/

  const newRow =
    sheet.getLastRow() + 1;


  sheet
    .getRange(newRow, 1)
    .setValue(
      normalized.value
    );


  sheet
    .getRange(newRow, 2)
    .setValue(true);


  /*
   * DELETE sheet:
   *
   * Column C = Added
   */

  if (sheetName === 'DELETE') {

    sheet
      .getRange(newRow, 3)
      .setValue(
        new Date()
      );

  }


  return {
    success: true,
    action: 'ADDED',
    list: sheetName,
    value: normalized.value
  };

}


/***************************************************************
 * REMOVE RULE
 *
 * We disable rather than physically delete the row.
 *
 * This preserves history and is easier to undo.
 ***************************************************************/

function removeRuleFromSheet(
  sheetName,
  value
) {

  const normalized =
    normalizeRuleInput(value);


  if (!normalized.valid) {

    throw new Error(
      `Invalid sender/domain: ${value}`
    );

  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(sheetName);


  if (!sheet) {

    throw new Error(
      `${sheetName} sheet not found.`
    );

  }


  if (sheet.getLastRow() < 2) {

    return {
      success: true,
      action: 'NOT_FOUND',
      list: sheetName,
      value: normalized.value
    };

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        2
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const existing =
      normalizeRuleInput(
        values[i][0]
      );


    if (
      existing.valid &&
      existing.value === normalized.value
    ) {

      sheet
        .getRange(
          i + 2,
          2
        )
        .setValue(false);


      return {
        success: true,
        action: 'DISABLED',
        list: sheetName,
        value: normalized.value
      };

    }

  }


  return {
    success: true,
    action: 'NOT_FOUND',
    list: sheetName,
    value: normalized.value
  };

}


/***************************************************************
 * NORMALIZE INPUT
 *
 * Accept:
 *
 * person@example.com
 * example.com
 * @example.com
 * *.example.com
 *
 * Store:
 *
 * person@example.com
 * example.com
 ***************************************************************/

function normalizeRuleInput(value) {

  let text =
    String(value || '')
      .trim()
      .toLowerCase();


  if (text.startsWith('*.')) {
    text = text.substring(2);
  }


  if (text.startsWith('@')) {
    text = text.substring(1);
  }


  if (!text) {

    return {
      valid: false
    };

  }


  if (text.includes('@')) {

    return {
      valid: isValidEmail(text),
      type: 'EMAIL',
      value: text
    };

  }


  return {
    valid: isValidDomain(text),
    type: 'DOMAIN',
    value: text
  };

}

/***************************************************************
 * APPLY RULE CHANGES
 *
 * Single controlled entry point for AI / external commands.
 *
 * Example:
 *
 * applyRuleChanges({
 *   addDelete: ['foo.com', 'bar@example.com'],
 *   removeDelete: [],
 *   addProtected: ['billing@foo.com'],
 *   removeProtected: []
 * });
 *
 * All inputs are validated BEFORE any changes are made.
 * After changes are applied, sync() runs exactly once.
 ***************************************************************/

function applyRuleChanges(changes) {

  changes = changes || {};

  const commands = {
    addDelete: changes.addDelete || [],
    removeDelete: changes.removeDelete || [],
    addProtected: changes.addProtected || [],
    removeProtected: changes.removeProtected || []
  };


  /*************************************************************
   * 1. VALIDATE STRUCTURE
   *************************************************************/

  for (const key in commands) {

    if (!Array.isArray(commands[key])) {
      throw new Error(
        `${key} must be an array.`
      );
    }

  }


  /*************************************************************
   * 2. VALIDATE EVERY RULE BEFORE CHANGING ANYTHING
   *************************************************************/

  const validated = {};

  for (const key in commands) {

    validated[key] = [];

    for (const value of commands[key]) {

      const normalized =
        normalizeRuleInput(value);

      if (!normalized.valid) {

        throw new Error(
          `Invalid sender/domain in ${key}: ${value}`
        );

      }

      validated[key].push(
        normalized.value
      );

    }

  }


  /*************************************************************
   * 3. APPLY CHANGES
   *************************************************************/

  const results = [];


  for (const value of validated.addDelete) {

    results.push(
      addDelete(value)
    );

  }


  for (const value of validated.removeDelete) {

    results.push(
      removeDelete(value)
    );

  }


  for (const value of validated.addProtected) {

    results.push(
      addProtected(value)
    );

  }


  for (const value of validated.removeProtected) {

    results.push(
      removeProtected(value)
    );

  }


  /*************************************************************
   * 4. RUN EXISTING DETERMINISTIC ENGINE ONCE
   *************************************************************/

  //sync();
  const syncResult = sync();


  /*************************************************************
   * 5. RETURN STRUCTURED RESULT
   *************************************************************/

  /**
  return {
    success: true,
    changes: results,
    syncCompleted: true
  };
  */
  return {
    success: true,
    changes: results,
    syncCompleted: true,
    sync: syncResult
  };

}


/***************************************************************
 * REMOVE RULE
 *
 * Test Rule Creation
 * 
 ***************************************************************/

function testRuleAPI() {

  console.log(
    JSON.stringify(
      addDelete(
        'testing-example.com'
      )
    )
  );


  console.log(
    JSON.stringify(
      addProtected(
        'important@testing-example.com'
      )
    )
  );

}

/***************************************************************
 * REMOVE RULE
 *
 * Test Rule Removal (by Disabling)
 * 
 ***************************************************************/
function testRuleRemoval() {

  console.log(
    JSON.stringify(
      removeDelete(
        'testing-example.com'
      )
    )
  );


  console.log(
    JSON.stringify(
      removeProtected(
        'important@testing-example.com'
      )
    )
  );

}

/***************************************************************
 * REMOVE RULE
 *
 * Test the whole chain (Add + Removal (Disable))
 * 
 ***************************************************************/

function testApplyRuleChanges() {

  const result =
    applyRuleChanges({

      addDelete: [
        'acme-test.com',
        'junk@widgets-test.com'
      ],

      removeDelete: [],

      addProtected: [
        'billing@acme-test.com'
      ],

      removeProtected: []

    });


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}