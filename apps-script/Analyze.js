/***************************************************************
 * GMAIL CLEANUP MANAGER - v2
 *
 * Rule analyzer
 *
 * NO Gmail access.
 ***************************************************************/


function analyzeRules() {

  const deletes =
    loadSheetRules('DELETE');

  const protectedRules =
    loadSheetRules('PROTECTED');

  const issues = [];


  /*************************************************************
   * REDUNDANT DELETE RULES
   *************************************************************/

  for (const rule of deletes) {

    const covering =
      deletes.find(other => {

        if (other.row === rule.row) {
          return false;
        }


        /*
         * Exact duplicate:
         * later row loses.
         */

        if (
          other.type === rule.type &&
          other.value === rule.value
        ) {

          return other.row < rule.row;

        }


        return ruleCovers(
          other,
          rule
        );

      });


    if (covering) {

      issues.push([

        new Date(),

        'INFO',

        'REDUNDANT DELETE',

        rule.value,

        `Covered by "${covering.value}"`

      ]);

    }

  }


  /*************************************************************
   * DELETE / PROTECTED CONFLICTS
   *************************************************************/

  const effectiveDeletes =
    optimizeRules(deletes);

  const effectiveProtected =
    optimizeRules(protectedRules);


  for (const del of effectiveDeletes) {

    for (const protect of effectiveProtected) {

      if (
        ruleCovers(del, protect) ||
        ruleCovers(protect, del)
      ) {

        issues.push([

          new Date(),

          'NOTICE',

          'PROTECTED OVERRIDE',

          del.value,

          `Overlaps protected rule "${protect.value}". ` +
          `PROTECTED wins.`

        ]);

      }

    }

  }


  writeIssues(issues);


  console.log(
    `DELETE: ${deletes.length}`
  );

  console.log(
    `Effective DELETE: ${effectiveDeletes.length}`
  );

  console.log(
    `PROTECTED: ${protectedRules.length}`
  );

  console.log(
    `Issues: ${issues.length}`
  );

}


/***************************************************************
 * WRITE ISSUES SHEET
 ***************************************************************/

function writeIssues(issues) {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName('ISSUES');


  if (!sheet) {
    sheet = ss.insertSheet('ISSUES');
  }


  sheet.clearContents();


  sheet
    .getRange(1, 1, 1, 5)
    .setValues([[
      'Timestamp',
      'Severity',
      'Type',
      'Rule',
      'Details'
    ]]);


  if (issues.length) {

    sheet
      .getRange(
        2,
        1,
        issues.length,
        5
      )
      .setValues(issues);

  }

}