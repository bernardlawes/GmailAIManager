/***************************************************************
 * GMAIL CLEANUP MANAGER - v2
 *
 * Consolidated Gmail filter builder
 *
 * CAUTION - THIS CREATES AND DELETES GMAIL FILTERS.
 *
 * Target maximum query length: 1400 characters
 * Gmail hard limit supplied for this project: 1500 characters
 ***************************************************************/

const MANAGED_FILTER_MAX_LENGTH = 1400;


/***************************************************************
 * PREVIEW CONSOLIDATED FILTERS
 ***************************************************************/

function previewDeleteFilters() {

  const deletes =
    optimizeRules(
      loadSheetRules('DELETE')
    );

  const protectedRules =
    optimizeRules(
      loadSheetRules('PROTECTED')
    );


  const filters =
    buildDeleteFilterChunks(
      deletes,
      protectedRules
    );


  console.log('');
  console.log('===== FILTER PREVIEW =====');

  console.log(
    `Effective DELETE rules: ${deletes.length}`
  );

  console.log(
    `PROTECTED rules: ${protectedRules.length}`
  );

  console.log(
    `Generated Gmail filters: ${filters.length}`
  );

  console.log('');


  filters.forEach(
    (filter, index) => {

      console.log(
        `FILTER ${index + 1}`
      );

      console.log(
        `Rules: ${filter.rules.length}`
      );

      console.log(
        `Characters: ${filter.query.length}`
      );

      console.log(
        `QUERY: ${filter.query}`
      );

      console.log('');

    }
  );


  console.log('===== COMPLETE =====');

}


/***************************************************************
 * BUILD FILTER CHUNKS
 *
 * Each completed query must remain <= our configured
 * maximum length.
 ***************************************************************/

function buildDeleteFilterChunks(
  deleteRules,
  protectedRules
) {

  const chunks = [];

  let currentRules = [];


  for (const rule of deleteRules) {

    const candidateRules =
      currentRules.concat(rule);


    const candidateQuery =
      buildConsolidatedFilterQuery(
        candidateRules,
        protectedRules
      );


    /*
     * Fits in current chunk.
     */

    if (
      candidateQuery.length <=
      MANAGED_FILTER_MAX_LENGTH
    ) {

      currentRules =
        candidateRules;

      continue;

    }


    /*
     * Current chunk is full.
     */

    if (currentRules.length) {

      chunks.push(
        makeFilterChunk(
          currentRules,
          protectedRules
        )
      );

    }


    /*
     * Start next chunk with this rule.
     */

    currentRules = [rule];


    /*
     * Safety check:
     *
     * A single DELETE rule plus its required
     * protections must itself fit.
     */

    const singleQuery =
      buildConsolidatedFilterQuery(
        currentRules,
        protectedRules
      );


    if (
      singleQuery.length >
      MANAGED_FILTER_MAX_LENGTH
    ) {

      throw new Error(
        `Rule cannot fit inside one Gmail filter: ` +
        `"${rule.value}" (${singleQuery.length} characters)`
      );

    }

  }


  /*
   * Save final chunk.
   */

  if (currentRules.length) {

    chunks.push(
      makeFilterChunk(
        currentRules,
        protectedRules
      )
    );

  }


  return chunks;

}


/***************************************************************
 * MAKE FINAL CHUNK OBJECT
 ***************************************************************/

function makeFilterChunk(
  rules,
  protectedRules
) {

  const query =
    buildConsolidatedFilterQuery(
      rules,
      protectedRules
    );


  return {

    rules: rules.slice(),

    query: query

  };

}


/***************************************************************
 * BUILD ONE CONSOLIDATED GMAIL QUERY
 *
 * Example:
 *
 * {from:a.com OR from:b@example.com OR from:c.com}
 * -from:protected@c.com
 ***************************************************************/

function buildConsolidatedFilterQuery(
  deleteRules,
  protectedRules
) {

  if (!deleteRules.length) {
    return '';
  }


  /*************************************************************
   * DELETE SIDE
   *************************************************************/

  const deleteTerms =
    deleteRules.map(
      rule =>
        gmailFromTerm(rule)
    );


  let query;


  if (deleteTerms.length === 1) {

    query =
      deleteTerms[0];

  } else {

    query =
      '{' +
      deleteTerms.join(' OR ') +
      '}';

  }


  /*************************************************************
   * PROTECTED SIDE
   *
   * Only include protections that intersect at least
   * one DELETE rule in this particular chunk.
   *************************************************************/

  const relevantProtected =
    protectedRules.filter(
      protectedRule =>

        deleteRules.some(
          deleteRule =>

            ruleCovers(
              deleteRule,
              protectedRule
            )

            ||

            ruleCovers(
              protectedRule,
              deleteRule
            )

        )

    );


  for (
    const protectedRule of
    relevantProtected
  ) {

    query +=
      ` -from:${protectedRule.value}`;

  }


  return query;

}

/***************************************************************
 * INSTALL CONSOLIDATED DELETE FILTERS
 *
 * Creates the filters generated by our validated chunk builder.
 *
 * Action: move matching future messages to TRASH.
 *
 * Does NOT delete or modify existing Gmail filters.
 ***************************************************************/

function installDeleteFilters() {

  const deletes =
    optimizeRules(
      loadSheetRules('DELETE')
    );

  const protectedRules =
    optimizeRules(
      loadSheetRules('PROTECTED')
    );

  const filters =
    buildDeleteFilterChunks(
      deletes,
      protectedRules
    );


  console.log('');
  console.log('===== INSTALL DELETE FILTERS =====');

  console.log(
    `Filters to install: ${filters.length}`
  );

  console.log('');


  /*
   * Read existing Gmail filters once.
   */

  const response =
    Gmail.Users.Settings.Filters.list('me');

  const existingFilters =
    response.filter || [];


  let created = 0;
  let alreadyExists = 0;


  for (
    let i = 0;
    i < filters.length;
    i++
  ) {

    const filter =
      filters[i];


    /*
     * Don't create an exact duplicate.
     */

    const exists =
      existingFilters.some(
        existing => {

          const criteria =
            existing.criteria || {};

          const action =
            existing.action || {};

          const labels =
            action.addLabelIds || [];


          return (
            criteria.query === filter.query &&
            labels.includes('TRASH')
          );

        }
      );


    if (exists) {

      console.log(
        `FILTER ${i + 1}: ALREADY EXISTS`
      );

      console.log(
        `QUERY: ${filter.query}`
      );

      console.log('');

      alreadyExists++;

      continue;

    }


    /*
     * Create Gmail filter.
     */

    Gmail.Users.Settings.Filters.create(
      {
        criteria: {
          query: filter.query
        },

        action: {
          addLabelIds: [
            'TRASH'
          ]
        }
      },
      'me'
    );


    console.log(
      `FILTER ${i + 1}: CREATED`
    );

    console.log(
      `Rules: ${filter.rules.length}`
    );

    console.log(
      `Characters: ${filter.query.length}`
    );

    console.log(
      `QUERY: ${filter.query}`
    );

    console.log('');


    created++;

  }


  console.log(
    '===== COMPLETE ====='
  );

  console.log(
    `CREATED: ${created}`
  );

  console.log(
    `ALREADY EXISTED: ${alreadyExists}`
  );

}

/***************************************************************
 * MANAGED FILTER SYNCHRONIZATION
 *
 * Script Properties stores the IDs of Gmail filters created
 * and managed by this script.
 *
 * We NEVER delete filters that are not recorded here.
 ***************************************************************/

const MANAGED_FILTER_IDS_KEY =
  'GMAIL_CLEANUP_MANAGED_FILTER_IDS';


/***************************************************************
 * GET MANAGED FILTER IDS
 ***************************************************************/

function getManagedFilterIds() {

  const value =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        MANAGED_FILTER_IDS_KEY
      );


  if (!value) {
    return [];
  }


  try {

    const ids =
      JSON.parse(value);

    return Array.isArray(ids)
      ? ids
      : [];

  } catch (error) {

    return [];

  }

}


/***************************************************************
 * SAVE MANAGED FILTER IDS
 ***************************************************************/

function saveManagedFilterIds(ids) {

  PropertiesService
    .getScriptProperties()
    .setProperty(
      MANAGED_FILTER_IDS_KEY,
      JSON.stringify(ids)
    );

}


/***************************************************************
 * SYNC GMAIL FILTERS
 *
 * 1. Build desired filters from current Sheet
 * 2. Create NEW filters
 * 3. If creation succeeds, remove OLD managed filters
 * 4. Save IDs of new filters
 *
 * Unrelated Gmail filters are NEVER touched.
 ***************************************************************/
function syncDeleteFilters() {

  const deletes =
    optimizeRules(
      loadSheetRules('DELETE')
    );

  const protectedRules =
    optimizeRules(
      loadSheetRules('PROTECTED')
    );

  const desiredFilters =
    buildDeleteFilterChunks(
      deletes,
      protectedRules
    );

  const oldManagedIds =
    getManagedFilterIds();


  console.log('');
  console.log(
    '===== SYNC DELETE FILTERS ====='
  );

  console.log(
    `Effective DELETE rules: ${deletes.length}`
  );

  console.log(
    `Desired Gmail filters: ${desiredFilters.length}`
  );

  console.log(
    `Previously managed filters: ${oldManagedIds.length}`
  );

  console.log('');


  /*
   * Read the current Gmail filters.
   *
   * We only REUSE filters whose IDs are already recorded
   * as managed by this script.
   *
   * Unrelated/manual Gmail filters are never adopted.
   */

  const response =
    Gmail.Users.Settings.Filters.list('me');

  const existingFilters =
    response.filter || [];

  const existingManagedFilters =
    existingFilters.filter(
      filter =>
        oldManagedIds.includes(filter.id)
    );


  /*
   * Build the desired filter set.
   *
   * If one of our existing managed filters already has
   * exactly the desired query + TRASH action, reuse it.
   *
   * Otherwise create a new filter.
   */

  const newFilterIds = [];
  const createdFilterIds = [];

  try {

    for (
      let i = 0;
      i < desiredFilters.length;
      i++
    ) {

      const filter =
        desiredFilters[i];


      /*
       * Look for an identical filter among filters that
       * this script already owns.
       */

      const reusable =
        existingManagedFilters.find(
          existing => {

            const criteria =
              existing.criteria || {};

            const action =
              existing.action || {};

            const labels =
              action.addLabelIds || [];

            return (
              criteria.query === filter.query &&
              labels.includes('TRASH') &&
              !newFilterIds.includes(existing.id)
            );

          }
        );


      if (reusable) {

        newFilterIds.push(
          reusable.id
        );

        console.log(
          `REUSED EXISTING FILTER ${i + 1}`
        );

        console.log(
          `ID: ${reusable.id}`
        );

        console.log(
          `Rules: ${filter.rules.length}`
        );

        console.log(
          `Characters: ${filter.query.length}`
        );

        console.log(
          `QUERY: ${filter.query}`
        );

        console.log('');

        continue;
      }


      /*
       * No identical managed filter exists.
       * Create a new one.
       */

      const created =
        Gmail.Users.Settings.Filters.create(
          {
            criteria: {
              query: filter.query
            },

            action: {
              addLabelIds: [
                'TRASH'
              ]
            }
          },
          'me'
        );


      newFilterIds.push(
        created.id
      );

      createdFilterIds.push(
        created.id
      );


      console.log(
        `CREATED NEW FILTER ${i + 1}`
      );

      console.log(
        `ID: ${created.id}`
      );

      console.log(
        `Rules: ${filter.rules.length}`
      );

      console.log(
        `Characters: ${filter.query.length}`
      );

      console.log(
        `QUERY: ${filter.query}`
      );

      console.log('');

    }

  } catch (error) {

    /*
     * Creation failed.
     *
     * Remove only filters created during THIS sync.
     * Reused filters and the old managed set remain.
     */

    console.log(
      'ERROR: New filter set could not be completed.'
    );

    console.log(
      'Old managed filters will remain in place.'
    );


    for (const id of createdFilterIds) {

      try {

        Gmail.Users.Settings.Filters.remove(
          'me',
          id
        );

      } catch (cleanupError) {

        console.log(
          `WARNING: Could not clean up new filter ${id}`
        );

      }

    }

    throw error;
  }


  /*
   * Desired filter set now exists.
   *
   * Remove only OLD managed filters that are no longer
   * part of the desired set.
   */

  let removed = 0;


  for (const id of oldManagedIds) {

    /*
     * Reused filters remain managed and must not
     * be removed.
     */

    if (
      newFilterIds.includes(id)
    ) {

      continue;
    }


    try {

      Gmail.Users.Settings.Filters.remove(
        'me',
        id
      );

      removed++;

      console.log(
        `REMOVED OLD FILTER: ${id}`
      );

    } catch (error) {

      /*
       * It may already have been manually removed
       * from Gmail.
       *
       * Do not abort the entire sync.
       */

      console.log(
        `OLD FILTER NOT FOUND / COULD NOT REMOVE: ${id}`
      );

    }

  }


  /*
   * Save the final ownership list.
   */

  saveManagedFilterIds(
    newFilterIds
  );


  console.log('');
  console.log(
    '===== FILTER SYNC COMPLETE ====='
  );

  console.log(
    `FILTERS IN DESIRED SET: ${newFilterIds.length}`
  );

  console.log(
    `REUSED FILTERS: ${
      newFilterIds.length -
      createdFilterIds.length
    }`
  );

  console.log(
    `NEW FILTERS CREATED: ${createdFilterIds.length}`
  );

  console.log(
    `OLD FILTERS REMOVED: ${removed}`
  );

  const reusedCount = newFilterIds.length - createdFilterIds.length;
  const removedCount = removed;

  return {
    desired: desiredFilters.length,
    reused: reusedCount,
    created: createdFilterIds.length,
    removed: removedCount
  };

}