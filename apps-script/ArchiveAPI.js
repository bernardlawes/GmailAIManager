/***************************************************************
 * GMAIL AI MANAGER - ARCHIVE API
 *
 * Deterministic execution of explicitly approved
 * message-level LABEL and ARCHIVE actions.
 *
 * This does NOT create permanent sender rules.
 ***************************************************************/


/***************************************************************
 * APPLY MESSAGE ACTIONS
 *
 * Example:
 *
 * applyMessageActions([
 *   {
 *     messageId: 'abc123',
 *     labels: ['RECEIPTS/Food'],
 *     archive: true
 *   }
 * ]);
 *
 * ALL actions are validated before Gmail is modified.
 ***************************************************************/

function applyMessageActions(actions) {

  /*************************************************************
   * 1. VALIDATE REQUEST STRUCTURE
   *************************************************************/

  if (!Array.isArray(actions)) {
    throw new Error(
      'actions must be an array.'
    );
  }


  if (!actions.length) {

    return {
      success: true,
      requested: 0,
      processed: 0,
      labelsApplied: 0,
      archived: 0
    };

  }


  /*************************************************************
   * 2. VALIDATE ALL ACTIONS BEFORE MODIFYING GMAIL
   *************************************************************/

  const validated = [];

  for (const action of actions) {

    if (
      !action ||
      typeof action !== 'object' ||
      Array.isArray(action)
    ) {
      throw new Error(
        'Each action must be an object.'
      );
    }


    if (
      typeof action.messageId !== 'string' ||
      !action.messageId.trim()
    ) {
      throw new Error(
        'Each action requires a valid messageId.'
      );
    }


    if (typeof action.archive !== 'boolean') {
      throw new Error(
        `archive must be true or false for message ${action.messageId}`
      );
    }


    const labels =
      validateGmailAILabels(
        action.labels || []
      );


    validated.push({
      messageId: action.messageId.trim(),
      labels: labels,
      archive: action.archive
    });

  }


  /*************************************************************
   * 3. RESOLVE CANONICAL LABEL NAMES TO GMAIL LABEL IDs
   *
   * Existing labels only.
   * Missing labels are NOT created automatically.
   *************************************************************/

  const gmailLabels =
    Gmail.Users.Labels.list('me');

  const labelIdByName = {};


  for (
    const label of
    (gmailLabels.labels || [])
  ) {

    labelIdByName[label.name] =
      label.id;

  }


  /*
   * Validate existence BEFORE modifying any messages.
   */

  for (const action of validated) {

    for (const labelName of action.labels) {

      if (!labelIdByName[labelName]) {

        throw new Error(
          `Gmail label does not exist: ${labelName}`
        );

      }

    }

  }


  /*************************************************************
   * 4. EXECUTE APPROVED ACTIONS
   *************************************************************/

  let processed = 0;
  let labelsApplied = 0;
  let archived = 0;


  for (const action of validated) {

    const addLabelIds =
      action.labels.map(
        labelName =>
          labelIdByName[labelName]
      );


    const removeLabelIds =
      action.archive
        ? ['INBOX']
        : [];


    Gmail.Users.Messages.modify(
      {
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds
      },
      'me',
      action.messageId
    );


    processed++;

    labelsApplied +=
      action.labels.length;


    if (action.archive) {
      archived++;
    }

  }


  /*************************************************************
   * 5. RETURN EXECUTION STATISTICS
   *************************************************************/

  return {
    success: true,
    requested: validated.length,
    processed: processed,
    labelsApplied: labelsApplied,
    archived: archived
  };

}


/***************************************************************
 * VALIDATION TEST
 *
 * SAFE:
 * Intentionally invalid label.
 * Should fail before Gmail is modified.
 ***************************************************************/

function testMessageActionValidation() {

  try {

    const result =
      applyMessageActions([
        {
          messageId: 'DO-NOT-EXIST',
          labels: [
            'RECEIPTS/Fod'
          ],
          archive: true
        }
      ]);


    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );


  } catch (error) {

    console.log(
      'EXPECTED ERROR: ' +
      error.message
    );

  }

}

/***************************************************************
 * TEST HELPER - FIND RECENT MESSAGE
 *
 * READ ONLY.
 ***************************************************************/

function testFindMessage() {

  const results =
    Gmail.Users.Messages.list(
      'me',
      {
        q: 'in:inbox',
        maxResults: 10
      }
    );


  for (
    const message of
    (results.messages || [])
  ) {

    const fullMessage =
      Gmail.Users.Messages.get(
        'me',
        message.id,
        {
          format: 'metadata',
          metadataHeaders: [
            'From',
            'Subject'
          ]
        }
      );


    const headers = {};

    for (
      const header of
      (fullMessage.payload.headers || [])
    ) {

      headers[header.name] =
        header.value;

    }


    console.log(
      JSON.stringify({
        messageId: message.id,
        from: headers.From || '',
        subject: headers.Subject || ''
      })
    );

  }

}

function testApplyRealLabel() {

  const result =
    applyMessageActions([
      {
        messageId: '1a0fe6b734f8ef03',
        labels: [
          'LEARN/Newsletters'
        ],
        archive: false
      }
    ]);


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}

function testArchiveRealMessage() {

  const result =
    applyMessageActions([
      {
        messageId: '1a0fe6b734f8ef03',
        labels: [],
        archive: true
      }
    ]);

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}


/***************************************************************
 * APPLY THREAD ACTIONS
 *
 * Deterministic execution of explicitly approved
 * thread-level LABEL and ARCHIVE actions.
 *
 * ALL actions are validated before Gmail is modified.
 ***************************************************************/

function applyThreadActions(actions) {

  /*************************************************************
   * 1. VALIDATE REQUEST STRUCTURE
   *************************************************************/

  if (!Array.isArray(actions)) {
    throw new Error(
      'actions must be an array.'
    );
  }


  if (!actions.length) {

    return {
      success: true,
      requested: 0,
      processed: 0,
      labelsApplied: 0,
      archived: 0
    };

  }


  /*************************************************************
   * 2. VALIDATE ALL ACTIONS
   *************************************************************/

  const validated = [];

  for (const action of actions) {

    if (
      !action ||
      typeof action !== 'object' ||
      Array.isArray(action)
    ) {
      throw new Error(
        'Each action must be an object.'
      );
    }


    if (
      typeof action.threadId !== 'string' ||
      !action.threadId.trim()
    ) {
      throw new Error(
        'Each action requires a valid threadId.'
      );
    }


    if (typeof action.archive !== 'boolean') {
      throw new Error(
        `archive must be true or false for thread ${action.threadId}`
      );
    }


    const labels =
      validateGmailAILabels(
        action.labels || []
      );


    validated.push({
      threadId: action.threadId.trim(),
      labels: labels,
      archive: action.archive
    });

  }


  /*************************************************************
   * 3. RESOLVE LABEL NAMES TO EXISTING GMAIL LABEL IDs
   *************************************************************/

  const gmailLabels =
    Gmail.Users.Labels.list('me');

  const labelIdByName = {};


  for (
    const label of
    (gmailLabels.labels || [])
  ) {

    labelIdByName[label.name] =
      label.id;

  }


  /*
   * Validate ALL labels exist before modifying Gmail.
   */

  for (const action of validated) {

    for (const labelName of action.labels) {

      if (!labelIdByName[labelName]) {

        throw new Error(
          `Gmail label does not exist: ${labelName}`
        );

      }

    }

  }


  /*************************************************************
   * 4. EXECUTE APPROVED THREAD ACTIONS
   *************************************************************/

  let processed = 0;
  let labelsApplied = 0;
  let archived = 0;


  for (const action of validated) {

    const addLabelIds =
      action.labels.map(
        labelName =>
          labelIdByName[labelName]
      );


    const removeLabelIds =
      action.archive
        ? ['INBOX']
        : [];


    Gmail.Users.Threads.modify(
      {
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds
      },
      'me',
      action.threadId
    );


    processed++;

    labelsApplied +=
      action.labels.length;


    if (action.archive) {
      archived++;
    }

  }


  /*************************************************************
   * 5. RETURN EXECUTION STATISTICS
   *************************************************************/

  return {
    success: true,
    requested: validated.length,
    processed: processed,
    labelsApplied: labelsApplied,
    archived: archived
  };

}

function testFindThreads() {

  const results =
    Gmail.Users.Threads.list(
      'me',
      {
        q: 'in:inbox',
        maxResults: 10
      }
    );


  for (
    const thread of
    (results.threads || [])
  ) {

    const fullThread =
      Gmail.Users.Threads.get(
        'me',
        thread.id,
        {
          format: 'metadata',
          metadataHeaders: [
            'From',
            'Subject'
          ]
        }
      );


    const messages =
      fullThread.messages || [];


    if (!messages.length) {
      continue;
    }


    /*
     * Use metadata from the newest message
     * in the thread for display.
     */

    const newestMessage =
      messages[messages.length - 1];

    const headers = {};


    for (
      const header of
      (newestMessage.payload.headers || [])
    ) {

      headers[header.name] =
        header.value;

    }


    console.log(
      JSON.stringify({
        threadId: thread.id,
        messages: messages.length,
        from: headers.From || '',
        subject: headers.Subject || ''
      })
    );

  }

}

function testApplyRealThreadLabel() {

  const result =
    applyThreadActions([
      {
        threadId: '1a0ff975220e2451',
        labels: [
          'PERSONAL'
        ],
        archive: false
      }
    ]);

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}

function testArchiveRealThread() {

  const result =
    applyThreadActions([
      {
        threadId: '1a0ff975220e2451',
        labels: [],
        archive: true
      }
    ]);

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}