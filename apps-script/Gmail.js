/***************************************************************
 * GMAIL CLEANUP MANAGER - v2
 *
 * Gmail API DRY RUN
 *
 * READ ONLY.
 * THIS FILE CANNOT DELETE EMAIL.
 ***************************************************************/


function dryRun() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const deleteSheet =
    ss.getSheetByName('DELETE');


  const deletes =
    loadSheetRules('DELETE');

  const protectedRules =
    optimizeRules(
      loadSheetRules('PROTECTED')
    );

  const effectiveDeletes =
    optimizeRules(deletes);


  console.log('');
  console.log('===== DRY RUN =====');

  console.log(
    `DELETE rules: ${deletes.length}`
  );

  console.log(
    `Effective DELETE rules: ${effectiveDeletes.length}`
  );

  console.log(
    `PROTECTED rules: ${protectedRules.length}`
  );

  console.log('');


  /*
   * Clear Existing Messages + Status.
   *
   * D = Existing Messages
   * E = Status
   */

  if (deleteSheet.getLastRow() >= 2) {

    deleteSheet
      .getRange(
        2,
        4,
        deleteSheet.getLastRow() - 1,
        2
      )
      .clearContent();

  }


  let total = 0;


  /*************************************************************
   * EFFECTIVE RULES
   *************************************************************/

  for (const rule of effectiveDeletes) {

    const query =
      buildSafeQuery(
        rule,
        protectedRules
      );


    const start =
      Date.now();


    const ids =
      searchGmailIds(query);


    const count =
      ids.length;


    total += count;


    const seconds =
      (
        (Date.now() - start) /
        1000
      ).toFixed(2);


    /*
     * Update Sheet.
     */

    deleteSheet
      .getRange(
        rule.row,
        4
      )
      .setValue(count);


    deleteSheet
      .getRange(
        rule.row,
        5
      )
      .setValue(
        count
          ? `WOULD TRASH ${count}`
          : 'NOTHING TO TRASH'
      );


    console.log(
      `${rule.value} | ${count} | ${seconds}s`
    );

    console.log(
      `QUERY: ${query}`
    );

  }


  /*************************************************************
   * MARK REDUNDANT ROWS
   *************************************************************/

  const effectiveRows =
    new Set(
      effectiveDeletes.map(
        rule => rule.row
      )
    );


  for (const rule of deletes) {

    if (
      !effectiveRows.has(rule.row)
    ) {

      deleteSheet
        .getRange(
          rule.row,
          4
        )
        .setValue(0);


      deleteSheet
        .getRange(
          rule.row,
          5
        )
        .setValue(
          'REDUNDANT'
        );

    }

  }


  console.log('');
  console.log('===== COMPLETE =====');

  console.log(
    `TOTAL WOULD TRASH: ${total}`
  );

}


/***************************************************************
 * BUILD SAFE QUERY
 ***************************************************************/

function buildSafeQuery(
  deleteRule,
  protectedRules
) {

  const parts = [

    gmailFromTerm(
      deleteRule
    )

  ];


  for (
    const protectedRule of
    protectedRules
  ) {

    /*
     * Only add exclusions that could actually
     * intersect this DELETE rule.
     */

    if (
      ruleCovers(
        deleteRule,
        protectedRule
      )

      ||

      ruleCovers(
        protectedRule,
        deleteRule
      )
    ) {

      parts.push(
        `-from:${protectedRule.value}`
      );

    }

  }


  return parts.join(' ');

}


/***************************************************************
 * FAST MESSAGE-ID SEARCH
 ***************************************************************/

function searchGmailIds(query) {

  const ids = [];

  let pageToken = null;


  do {

    const response =
      Gmail.Users.Messages.list(
        'me',
        {
          q: query,
          maxResults: 500,
          pageToken: pageToken
        }
      );


    if (response.messages) {

      response.messages.forEach(
        message =>
          ids.push(message.id)
      );

    }


    pageToken =
      response.nextPageToken || null;


  } while (pageToken);


  return ids;

}


/***************************************************************
 * TRASH MATCHING EMAIL
 *
 * Uses the EXACT SAME:
 *   - rule optimization
 *   - protected-rule handling
 *   - query compiler
 *   - Gmail search
 *
 * already validated by dryRun().
 *
 * Messages are moved to Gmail Trash.
 * They are NOT permanently deleted.
 ***************************************************************/


function trashDeleteRules() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const deleteSheet =
    ss.getSheetByName('DELETE');


  const deletes =
    loadSheetRules('DELETE');

  const protectedRules =
    optimizeRules(
      loadSheetRules('PROTECTED')
    );

  const effectiveDeletes =
    optimizeRules(deletes);


  console.log('');
  console.log('===== TRASH RUN =====');

  console.log(
    `DELETE rules: ${deletes.length}`
  );

  console.log(
    `Effective DELETE rules: ${effectiveDeletes.length}`
  );

  console.log(
    `PROTECTED rules: ${protectedRules.length}`
  );

  console.log('');


  let totalTrashed = 0;


  /*************************************************************
   * PROCESS EACH EFFECTIVE DELETE RULE
   *************************************************************/

  for (const rule of effectiveDeletes) {

    const query =
      buildSafeQuery(
        rule,
        protectedRules
      );


    console.log(
      `RULE: ${rule.value}`
    );

    console.log(
      `QUERY: ${query}`
    );


    /*
     * Same search function used by dryRun().
     */

    const ids =
      searchGmailIds(query);


    console.log(
      `FOUND: ${ids.length}`
    );


    /***********************************************************
     * NOTHING TO DO
     ***********************************************************/

    if (!ids.length) {

      deleteSheet
        .getRange(
          rule.row,
          4
        )
        .setValue(0);


      deleteSheet
        .getRange(
          rule.row,
          5
        )
        .setValue(
          'NOTHING TO TRASH'
        );


      console.log(
        'TRASHED: 0'
      );

      console.log('');

      continue;

    }


    /***********************************************************
     * MOVE MESSAGE IDs TO TRASH
     *
     * Gmail API supports batchModify with up to 1000 IDs.
     *
     * Add the TRASH system label.
     ***********************************************************/

    const batchSize = 1000;

    let trashedForRule = 0;


    for (
      let i = 0;
      i < ids.length;
      i += batchSize
    ) {

      const batch =
        ids.slice(
          i,
          i + batchSize
        );


      Gmail.Users.Messages.batchModify(
        {
          ids: batch,

          addLabelIds: [
            'TRASH'
          ]
        },
        'me'
      );


      trashedForRule +=
        batch.length;

    }


    totalTrashed +=
      trashedForRule;


    /***********************************************************
     * UPDATE SHEET
     ***********************************************************/

    deleteSheet
      .getRange(
        rule.row,
        4
      )
      .setValue(
        trashedForRule
      );


    deleteSheet
      .getRange(
        rule.row,
        5
      )
      .setValue(
        `TRASHED ${trashedForRule}`
      );


    console.log(
      `TRASHED: ${trashedForRule}`
    );

    console.log('');

  }


  /*************************************************************
   * MARK REDUNDANT DELETE ROWS
   *************************************************************/

  const effectiveRows =
    new Set(
      effectiveDeletes.map(
        rule => rule.row
      )
    );


  for (const rule of deletes) {

    if (
      !effectiveRows.has(rule.row)
    ) {

      deleteSheet
        .getRange(
          rule.row,
          4
        )
        .setValue(0);


      deleteSheet
        .getRange(
          rule.row,
          5
        )
        .setValue(
          'REDUNDANT'
        );

    }

  }


  console.log(
    '===== COMPLETE ====='
  );

  console.log(
    `TOTAL TRASHED: ${totalTrashed}`
  );

  return {
    totalTrashed: totalTrashed
  };

}