/***************************************************************
 * GMAIL CLEANUP MANAGER - v2
 *
 * Core rule and sheet functions
 *
 * RULES:
 *   person@example.com = exact sender
 *   example.com        = domain + all subdomains
 ***************************************************************/


function loadSheetRules(sheetName) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`${sheetName} sheet not found.`);
  }

  if (sheet.getLastRow() < 2) {
    return [];
  }

  const rows =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        2
      )
      .getValues();

  const rules = [];

  rows.forEach((row, index) => {

    let text =
      String(row[0] || '')
        .trim()
        .toLowerCase();

    const enabled =
      row[1] === true;


    if (!text || !enabled) {
      return;
    }


    /*
     * Backward compatibility.
     *
     * If an old rule contains:
     *
     * *.example.com
     *
     * simply treat it as:
     *
     * example.com
     */

    if (text.startsWith('*.')) {
      text = text.substring(2);
    }

    if (text.startsWith('@')) {
      text = text.substring(1);
    }


    let type;


    if (text.includes('@')) {

      if (!isValidEmail(text)) {
        return;
      }

      type = 'EMAIL';

    } else {

      if (!isValidDomain(text)) {
        return;
      }

      type = 'DOMAIN';

    }


    rules.push({

      row: index + 2,

      value: text,

      type: type

    });

  });


  return rules;
}


function isValidEmail(value) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(value);

}


function isValidDomain(value) {

  return (
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) &&
    !value.includes('..')
  );

}


/***************************************************************
 * DOES DOMAIN RULE COVER ANOTHER RULE?
 *
 * example.com covers:
 *
 * person@example.com
 * person@mail.example.com
 * mail.example.com
 ***************************************************************/

function ruleCovers(broad, narrow) {

  if (
    broad.type === 'EMAIL'
  ) {

    return (
      narrow.type === 'EMAIL' &&
      broad.value === narrow.value
    );

  }


  if (
    broad.type === 'DOMAIN'
  ) {

    if (
      narrow.type === 'EMAIL'
    ) {

      const domain =
        narrow.value.split('@').pop();

      return (
        domain === broad.value ||
        domain.endsWith(
          '.' + broad.value
        )
      );

    }


    if (
      narrow.type === 'DOMAIN'
    ) {

      return (
        narrow.value === broad.value ||
        narrow.value.endsWith(
          '.' + broad.value
        )
      );

    }

  }


  return false;
}


/***************************************************************
 * REMOVE DUPLICATES / REDUNDANT RULES
 ***************************************************************/

function optimizeRules(rules) {

  const effective = [];


  for (
    let i = 0;
    i < rules.length;
    i++
  ) {

    let covered = false;


    for (
      let j = 0;
      j < rules.length;
      j++
    ) {

      if (i === j) {
        continue;
      }


      /*
       * If identical, keep the first row.
       */

      if (
        rules[i].type === rules[j].type &&
        rules[i].value === rules[j].value
      ) {

        if (rules[j].row < rules[i].row) {
          covered = true;
          break;
        }

        continue;
      }


      if (
        ruleCovers(
          rules[j],
          rules[i]
        )
      ) {

        covered = true;
        break;

      }

    }


    if (!covered) {
      effective.push(rules[i]);
    }

  }


  return effective;
}


/***************************************************************
 * GMAIL SEARCH TERM
 ***************************************************************/

function gmailFromTerm(rule) {

  return `from:${rule.value}`;

}

/***************************************************************
 * GMAIL AI MANAGER - INITIAL SETUP
 *
 * Safe, idempotent installation bootstrap.
 *
 * Creates required spreadsheet tabs and canonical Gmail labels.
 *
 * It DOES NOT:
 *   - delete, archive, or modify email
 *   - create Gmail filters
 *   - install triggers
 *   - overwrite existing sheet data
 *   - create or store secrets
 ***************************************************************/

function setupGmailAIManager() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetDefinitions = [
    {
      name: 'DELETE',
      headers: [
        'Sender',
        'Enabled',
        'Added',
        'Existing Messages',
        'Status'
      ]
    },
    {
      name: 'PROTECTED',
      headers: [
        'Sender / Domain',
        'Enabled',
        'Notes'
      ]
    },
    {
      name: 'AUTO',
      headers: [
        'Sender',
        'Label',
        'Archive'
      ]
    },
    {
      name: 'ISSUES',
      headers: [
        'Timestamp',
        'Severity',
        'Type',
        'Rule',
        'Details'
      ]
    }
  ];


  /*************************************************************
   * PHASE 1 - VALIDATE EXISTING SHEETS
   *
   * Make no changes during this phase.
   *************************************************************/

  for (const definition of sheetDefinitions) {

    const sheet =
      ss.getSheetByName(definition.name);

    /*
     * Missing and completely empty sheets are valid.
     * They will be initialized in Phase 2.
     */

    if (!sheet || sheet.getLastRow() === 0) {
      continue;
    }

    const existingHeaders =
      sheet
        .getRange(
          1,
          1,
          1,
          definition.headers.length
        )
        .getValues()[0]
        .map(value => String(value).trim());

    const headersMatch =
      definition.headers.every(
        (expected, index) =>
          existingHeaders[index] === expected
      );

    if (!headersMatch) {

      throw new Error(
        `${definition.name} sheet has unexpected headers. ` +
        `Expected: ${definition.headers.join(' | ')}. ` +
        `Found: ${existingHeaders.join(' | ')}.`
      );

    }

  }


  /*************************************************************
   * PHASE 2 - CREATE / INITIALIZE SHEETS
   *
   * Phase 1 succeeded, so required spreadsheet changes can now
   * be made safely.
   *************************************************************/

  const results = [];

  for (const definition of sheetDefinitions) {

    let sheet =
      ss.getSheetByName(definition.name);

    let created = false;
    let headersInitialized = false;

    if (!sheet) {

      sheet =
        ss.insertSheet(definition.name);

      created = true;

    }

    if (sheet.getLastRow() === 0) {

      sheet
        .getRange(
          1,
          1,
          1,
          definition.headers.length
        )
        .setValues([
          definition.headers
        ]);

      sheet.setFrozenRows(1);

      headersInitialized = true;

    }

    results.push({
      sheet: definition.name,
      created: created,
      headersInitialized: headersInitialized
    });

  }


  /*************************************************************
   * PHASE 3 - CREATE CANONICAL GMAIL LABELS
   *************************************************************/

  const labelResult =
    setupCanonicalLabels();


  return {
    success: true,
    accountType: GMAIL_AI_ACCOUNT_TYPE,
    sheets: results,
    labels: labelResult
  };

}

/***************************************************************
 * MASTER SYNC
 *
 * Normal day-to-day entry point.
 *
 * 1. Analyze current rules
 * 2. Trash existing matching messages
 * 3. Synchronize Gmail filters for future messages
 ***************************************************************/

function sync() {

  console.log('');
  console.log('================================');
  console.log('GMAIL CLEANUP SYNC');
  console.log('================================');
  console.log('');


  /*************************************************************
   * STEP 1 - ANALYZE
   *************************************************************/

  console.log('STEP 1: ANALYZE RULES');
  console.log('');

  analyzeRules();


  /*************************************************************
   * STEP 2 - CLEAN EXISTING MAIL
   *************************************************************/

  console.log('');
  console.log('STEP 2: CLEAN EXISTING MAIL');
  console.log('');

  //trashDeleteRules();
  const trashResult = trashDeleteRules();


  /*************************************************************
   * STEP 3 - SYNC FUTURE-MAIL FILTERS
   *************************************************************/

  console.log('');
  console.log('STEP 3: SYNC GMAIL FILTERS');
  console.log('');

  //syncDeleteFilters();
  const filterResult = syncDeleteFilters();


  /*************************************************************
   * DONE
   *************************************************************/

  console.log('');
  console.log('================================');
  console.log('SYNC COMPLETE');
  console.log('================================');

  return {
    trash: trashResult,
    filters: filterResult
  };

}