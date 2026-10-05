/*************************************************************************
 * GMAIL AI MANAGER - LABELED FILTER MANAGER
 *
 * Builds and synchronizes native Gmail filters from AUTO rules.
 *
 * AUTO source:
 *   SENDER | LABEL | ARCHIVE
 *
 * Rules having identical LABEL + ARCHIVE actions are consolidated
 * into as few Gmail filters as possible.
 *
 * This manager has its own filter ownership namespace.
 * It does NOT manage DELETE filters or unrelated Gmail filters.
 *************************************************************************/

const LABELED_FILTER_MAX_LENGTH = 1400;

const MANAGED_LABELED_FILTER_IDS_KEY =
  'GMAIL_AI_MANAGED_LABELED_FILTER_IDS';


/*************************************************************************
 * PREVIEW LABELED FILTERS
 *
 * Safe/read-only. Does not create or delete filters.
 *************************************************************************/

function previewLabeledFilters() {

  const rules =
    getAutoRules();

  const filters =
    buildLabeledFilterChunks(rules);

  console.log('');
  console.log('===== LABELED FILTER PREVIEW =====');

  console.log(
    `AUTO rules: ${rules.length}`
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
        `Label: ${filter.label}`
      );

      console.log(
        `Archive: ${filter.archive}`
      );

      console.log(
        `Senders: ${filter.rules.length}`
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

  return {
    rules: rules.length,
    filters: filters.length
  };
}


/*************************************************************************
 * BUILD LABELED FILTER CHUNKS
 *
 * 1. Group AUTO rules by LABEL + ARCHIVE.
 * 2. Consolidate senders within each group.
 * 3. Split groups when the query would exceed our configured maximum.
 *************************************************************************/

function buildLabeledFilterChunks(rules) {

  if (!Array.isArray(rules)) {
    throw new Error(
      'AUTO rules must be an array.'
    );
  }

  const groups = {};

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

    const key =
      JSON.stringify([
        rule.label,
        rule.archive
      ]);

    if (!groups[key]) {

      groups[key] = {
        label: rule.label,
        archive: rule.archive,
        rules: []
      };
    }

    groups[key].rules.push(rule);
  }

  const filters = [];

  for (const key of Object.keys(groups)) {

    const group =
      groups[key];

    let currentRules = [];

    for (const rule of group.rules) {

      const candidateRules =
        currentRules.concat(rule);

      const candidateQuery =
        buildLabeledFilterQuery(
          candidateRules
        );

      if (
        candidateQuery.length <=
        LABELED_FILTER_MAX_LENGTH
      ) {

        currentRules =
          candidateRules;

        continue;
      }

      /*
       * Current chunk is full.
       */
      if (currentRules.length) {

        filters.push(
          makeLabeledFilterChunk(
            currentRules,
            group.label,
            group.archive
          )
        );
      }

      /*
       * Start the next chunk.
       */
      currentRules = [rule];

      const singleQuery =
        buildLabeledFilterQuery(
          currentRules
        );

      if (
        singleQuery.length >
        LABELED_FILTER_MAX_LENGTH
      ) {

        throw new Error(
          'AUTO sender cannot fit inside one Gmail filter: ' +
          rule.sender +
          ' (' +
          singleQuery.length +
          ' characters)'
        );
      }
    }

    /*
     * Save final chunk for this action group.
     */
    if (currentRules.length) {

      filters.push(
        makeLabeledFilterChunk(
          currentRules,
          group.label,
          group.archive
        )
      );
    }
  }

  return filters;
}


/*************************************************************************
 * MAKE LABELED FILTER CHUNK
 *************************************************************************/

function makeLabeledFilterChunk(
  rules,
  label,
  archive
) {

  return {
    rules: rules.slice(),
    label: label,
    archive: archive,
    query:
      buildLabeledFilterQuery(rules)
  };
}


/*************************************************************************
 * BUILD CONSOLIDATED FROM QUERY
 *
 * Examples:
 *
 * One sender:
 *   from:sender@example.com
 *
 * Multiple senders:
 *   {from:a@example.com OR from:b@example.com}
 *************************************************************************/

function buildLabeledFilterQuery(rules) {

  if (!rules.length) {
    return '';
  }

  const terms =
    rules.map(
      rule =>
        `from:${rule.sender}`
    );

  if (terms.length === 1) {
    return terms[0];
  }

  return (
    '{' +
    terms.join(' OR ') +
    '}'
  );
}


/*************************************************************************
 * MANAGED LABELED FILTER IDS
 *************************************************************************/

function getManagedLabeledFilterIds() {

  const value =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        MANAGED_LABELED_FILTER_IDS_KEY
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


function saveManagedLabeledFilterIds(ids) {

  PropertiesService
    .getScriptProperties()
    .setProperty(
      MANAGED_LABELED_FILTER_IDS_KEY,
      JSON.stringify(ids)
    );
}


/*************************************************************************
 * RESOLVE USER LABEL IDS
 *************************************************************************/

function getLabeledFilterLabelIds() {

  const response =
    Gmail.Users.Labels.list('me');

  const idsByName = {};

  for (const label of (response.labels || [])) {

    idsByName[label.name] =
      label.id;
  }

  return idsByName;
}


/*************************************************************************
 * COMPARE EXISTING FILTER TO DESIRED FILTER
 *************************************************************************/

function labeledFilterMatches(
  existing,
  desired,
  labelId
) {

  const criteria =
    existing.criteria || {};

  const action =
    existing.action || {};

  const addLabelIds =
    action.addLabelIds || [];

  const removeLabelIds =
    action.removeLabelIds || [];

  const hasDesiredLabel =
    addLabelIds.includes(labelId);

  const archiveMatches =
    desired.archive
      ? removeLabelIds.includes('INBOX')
      : !removeLabelIds.includes('INBOX');

  return (
    criteria.query === desired.query &&
    hasDesiredLabel &&
    archiveMatches
  );
}


/*************************************************************************
 * SYNC LABELED FILTERS
 *
 * Safety model mirrors the existing DELETE filter manager:
 *
 * 1. Build desired filters from AUTO.
 * 2. Reuse identical filters already owned by this manager.
 * 3. Create missing desired filters.
 * 4. If creation fails, remove only filters created during THIS sync.
 * 5. Only after the desired set exists, remove obsolete filters owned
 *    by this manager.
 * 6. Save the resulting managed IDs.
 *
 * Manual/unrelated Gmail filters are never adopted or deleted.
 *************************************************************************/

function syncLabeledFilters() {

  const rules =
    getAutoRules();

  const desiredFilters =
    buildLabeledFilterChunks(rules);

  const oldManagedIds =
    getManagedLabeledFilterIds();

  const labelIdsByName =
    getLabeledFilterLabelIds();

  /*
   * Validate all required Gmail labels before
   * creating or removing any filters.
   */
  for (const filter of desiredFilters) {

    if (!labelIdsByName[filter.label]) {

      throw new Error(
        'Gmail label does not exist: ' +
        filter.label
      );
    }
  }

  console.log('');
  console.log(
    '===== SYNC LABELED FILTERS ====='
  );

  console.log(
    `AUTO rules: ${rules.length}`
  );

  console.log(
    `Desired Gmail filters: ${desiredFilters.length}`
  );

  console.log(
    `Previously managed filters: ${oldManagedIds.length}`
  );

  console.log('');

  /*
   * Read current Gmail filters once.
   */
  const response =
    Gmail.Users.Settings.Filters.list('me');

  const existingFilters =
    response.filter || [];

  /*
   * Only filters whose IDs were previously recorded
   * by THIS manager may be reused or removed.
   */
  const existingManagedFilters =
    existingFilters.filter(
      filter =>
        oldManagedIds.includes(filter.id)
    );

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

      const labelId =
        labelIdsByName[filter.label];

      /*
       * Reuse an identical filter only when it
       * already belongs to this manager.
       */
      const reusable =
        existingManagedFilters.find(
          existing =>

            !newFilterIds.includes(
              existing.id
            )

            &&

            labeledFilterMatches(
              existing,
              filter,
              labelId
            )
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
          `Label: ${filter.label}`
        );

        console.log(
          `Archive: ${filter.archive}`
        );

        console.log(
          `Senders: ${filter.rules.length}`
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
       * Build Gmail filter action.
       */
      const action = {
        addLabelIds: [
          labelId
        ]
      };

      if (filter.archive) {

        action.removeLabelIds = [
          'INBOX'
        ];
      }

      /*
       * Create missing desired filter.
       */
      const created =
        Gmail.Users.Settings.Filters.create(
          {
            criteria: {
              query: filter.query
            },

            action: action
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
        `Label: ${filter.label}`
      );

      console.log(
        `Archive: ${filter.archive}`
      );

      console.log(
        `Senders: ${filter.rules.length}`
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

    console.log(
      'ERROR: New labeled filter set could not be completed.'
    );

    console.log(
      'Old managed labeled filters will remain in place.'
    );

    /*
     * Roll back only filters created during
     * this synchronization attempt.
     */
    for (const id of createdFilterIds) {

      try {

        Gmail.Users.Settings.Filters.remove(
          'me',
          id
        );

      } catch (cleanupError) {

        console.log(
          `WARNING: Could not clean up new labeled filter ${id}`
        );
      }
    }

    throw error;
  }

  /*
   * Desired set now exists.
   *
   * Remove obsolete filters ONLY when their IDs
   * were owned by this labeled-filter manager.
   */
  let removed = 0;

  for (const id of oldManagedIds) {

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
        `REMOVED OLD LABELED FILTER: ${id}`
      );

    } catch (error) {

      console.log(
        `OLD LABELED FILTER NOT FOUND / COULD NOT REMOVE: ${id}`
      );
    }
  }

  /*
   * Record exactly the filters now owned by
   * this manager.
   */
  saveManagedLabeledFilterIds(
    newFilterIds
  );

  const reusedCount =
    newFilterIds.length -
    createdFilterIds.length;

  console.log('');

  console.log(
    '===== LABELED FILTER SYNC COMPLETE ====='
  );

  console.log(
    `FILTERS IN DESIRED SET: ${newFilterIds.length}`
  );

  console.log(
    `REUSED FILTERS: ${reusedCount}`
  );

  console.log(
    `NEW FILTERS CREATED: ${createdFilterIds.length}`
  );

  console.log(
    `OLD FILTERS REMOVED: ${removed}`
  );

  return {
    rules: rules.length,
    desired: desiredFilters.length,
    reused: reusedCount,
    created: createdFilterIds.length,
    removed: removed
  };
}


/*************************************************************************
 * SAFE PREVIEW TEST
 *
 * This does NOT create or remove Gmail filters.
 *************************************************************************/

function testPreviewLabeledFilters() {

  const result =
    previewLabeledFilters();

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}