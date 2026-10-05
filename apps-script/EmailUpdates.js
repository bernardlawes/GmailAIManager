/*************************************************************************
 * GMAIL AI MANAGER - EMAIL UPDATES
 *
 * Remote control for hourly Inbox snapshots.
 *
 * Authorized sender:
 *   As configured by the installation's authorized sender setting
 *
 * Recognized exact subjects:
 *   Enable Email Updates
 *   Pause Email Updates
 *   Disable Email Polling
 *
 * Provides remote command processing, ACTIVE/PAUSED state management,
 * hourly unread Inbox snapshots, confirmations, and polling control.
 *************************************************************************/
function getEmailUpdatesConfig() {

  return getGmailAIConfig().emailUpdates;

}

function getEmailUpdatesAuthorizedSender() {

  return getEmailUpdatesConfig().authorizedSender;

}

function getEmailUpdatesRecipient() {

  return getEmailUpdatesConfig().recipient;

}

function getEmailUpdatesCommandEnable() {

  return getEmailUpdatesConfig().commands.enable;

}

function getEmailUpdatesCommandPause() {

  return getEmailUpdatesConfig().commands.pause;

}

function getEmailUpdatesCommandDisable() {

  return getEmailUpdatesConfig().commands.disable;

}
/*************************************************************************
 * LOCAL CALENDAR DAY CHECK
 *
 * Determines whether a Gmail message timestamp falls on today's
 * calendar date in the Apps Script project's configured timezone.
 *************************************************************************/
function isEmailUpdateTimestampToday(timestamp) {
  const timeZone =
    Session.getScriptTimeZone();
  const today =
    Utilities.formatDate(
      new Date(),
      timeZone,
      'yyyy-MM-dd'
    );
  const messageDay =
    Utilities.formatDate(
      new Date(Number(timestamp)),
      timeZone,
      'yyyy-MM-dd'
    );
  return messageDay === today;
}
/*************************************************************************
 * FIND TODAY'S CONTROL MESSAGES
 *
 * READ ONLY.
 *
 * Searches only:
 *   - Inbox
 *   - authorized sender
 *   - current Gmail calendar day
 *
 * Then accepts only messages whose subject exactly matches one of our
 * recognized commands.
 *************************************************************************/
function getTodayEmailUpdateCommands() {
  const query =
    'in:inbox ' +
    'from:' +
    getEmailUpdatesAuthorizedSender() +
    ' newer_than:1d';
  const messageIds =
    searchGmailIds(query);
  const commands = [];
  for (const messageId of messageIds) {
    /*
     * Metadata only.
     * We do not need or retrieve the message body.
     */
    const message =
      Gmail.Users.Messages.get(
        'me',
        messageId,
        {
          format: 'metadata',
          metadataHeaders: [
            'From',
            'Subject',
            'Date'
          ]
        }
      );
    const headers =
      message.payload &&
      message.payload.headers
        ? message.payload.headers
        : [];
    const from =
      getEmailUpdateHeader(
        headers,
        'From'
      );
    const subject =
      getEmailUpdateHeader(
        headers,
        'Subject'
      );
    const dateHeader =
      getEmailUpdateHeader(
        headers,
        'Date'
      );
    /*
     * Defense in depth:
     * Gmail search already restricted the sender,
     * but independently verify the actual From header.
     */
    const senderAddress =
      extractEmailUpdateAddress(from);
    if (
      senderAddress.toLowerCase() !==
      getEmailUpdatesAuthorizedSender().toLowerCase()
    ) {
      continue;
    }
    const command =
      emailUpdateCommandFromSubject(
        subject
      );
    /*
     * Unknown subjects are ignored completely.
     */
    if (!command) {
      continue;
    }
    const timestamp =
      message.internalDate
        ? Number(message.internalDate)
        : Date.parse(dateHeader);

    /*
     * Gmail search only provides candidates.
     * Our own timezone-aware check defines "today".
     */
    if (
      !isEmailUpdateTimestampToday(
        timestamp
      )
    ) {
      continue;
    }
    commands.push({
      messageId: messageId,
      command: command,
      subject: subject,
      from: from,
      timestamp: timestamp,
      date: new Date(timestamp)
    });
  }
  /*
   * Oldest → newest.
   *
   * The final element therefore represents
   * the command that would win.
   */
  commands.sort(
    (a, b) =>
      a.timestamp - b.timestamp
  );
  return {
    success: true,
    query: query,
    commands: commands
  };
}
/*************************************************************************
 * EXACT SUBJECT → COMMAND
 *************************************************************************/
function emailUpdateCommandFromSubject(
  subject
) {
  if (
    subject ===
    getEmailUpdatesCommandEnable()
  ) {
    return 'ENABLE';
  }
  if (
    subject ===
    getEmailUpdatesCommandPause()
  ) {
    return 'PAUSE';
  }
  if (
    subject ===
    getEmailUpdatesCommandDisable()
  ) {
    return 'DISABLE';
  }
  return null;
}
/*************************************************************************
 * GET HEADER
 *************************************************************************/
function getEmailUpdateHeader(
  headers,
  name
) {
  const target =
    name.toLowerCase();
  for (const header of headers) {
    if (
      String(header.name || '')
        .toLowerCase() === target
    ) {
      return String(
        header.value || ''
      );
    }
  }
  return '';
}
/*************************************************************************
 * EXTRACT EMAIL ADDRESS
 *
 * Supports:
 *
 *   the configured authorized sender
 *
 * and:
 *
 *   First Name Last Name <the configured authorized sender>
 *************************************************************************/
function extractEmailUpdateAddress(
  from
) {
  const value =
    String(from || '').trim();
  const match =
    value.match(
      /<([^<>]+)>/
    );
  if (match) {
    return match[1].trim();
  }
  return value;
}
/*************************************************************************
 * EMAIL UPDATE STATE
 *************************************************************************/
const EMAIL_UPDATES_STATE_KEY =
  'EMAIL_UPDATES_STATE';
const EMAIL_UPDATES_STATE_ACTIVE =
  'ACTIVE';
const EMAIL_UPDATES_STATE_PAUSED =
  'PAUSED';
function getEmailUpdatesState() {
  return (
    PropertiesService
      .getScriptProperties()
      .getProperty(
        EMAIL_UPDATES_STATE_KEY
      ) ||
    EMAIL_UPDATES_STATE_PAUSED
  );
}
function setEmailUpdatesState(state) {
  if (
    state !== EMAIL_UPDATES_STATE_ACTIVE &&
    state !== EMAIL_UPDATES_STATE_PAUSED
  ) {
    throw new Error(
      'Invalid Email Updates state: ' +
      state
    );
  }
  PropertiesService
    .getScriptProperties()
    .setProperty(
      EMAIL_UPDATES_STATE_KEY,
      state
    );
  return state;
}
/*************************************************************************
 * ARCHIVE RECOGNIZED CONTROL MESSAGES
 *************************************************************************/
function archiveEmailUpdateCommands(
  commands
) {
  if (!commands || !commands.length) {
    return 0;
  }
  const ids =
    commands.map(
      item => item.messageId
    );
  Gmail.Users.Messages.batchModify(
    {
      ids: ids,
      removeLabelIds: [
        'INBOX'
      ]
    },
    'me'
  );
  return ids.length;
}

/*************************************************************************
 * SEND EMAIL UPDATE STATE CONFIRMATION
 *
 * Sends an immediate confirmation when Email Updates are
 * ENABLED or PAUSED.
 *************************************************************************/

function sendEmailUpdatesStateConfirmation(state) {

  let subject;
  let body;

  if (
    state ===
    EMAIL_UPDATES_STATE_ACTIVE
  ) {

    subject =
      'Gmail Email Updates - ENABLED';

    body =
      'Email Updates are now ACTIVE.\n\n' +
      'Hourly Inbox snapshots are enabled.';

  } else if (
    state ===
    EMAIL_UPDATES_STATE_PAUSED
  ) {

    subject =
      'Gmail Email Updates - PAUSED';

    body =
      'Email Updates are now PAUSED.\n\n' +
      'Hourly polling remains active, but Inbox snapshots will not be sent.';

  } else {

    throw new Error(
      'Cannot send confirmation for state: ' +
      state
    );
  }

  GmailApp.sendEmail(
    getEmailUpdatesRecipient(),
    subject,
    body
  );

  return {
    success: true,
    recipient:
      getEmailUpdatesRecipient(),
    subject: subject,
    state: state
  };

}

/*************************************************************************
 * PROCESS PENDING CONTROL COMMANDS
 *
 * Rules:
 *
 *   1. Find today's recognized Inbox commands.
 *   2. Determine the newest command.
 *   3. Archive ALL recognized commands.
 *   4. Execute ONLY the newest command.
 *
 * During this phase:
 *
 *   ENABLE  -> state ACTIVE
 *   PAUSE   -> state PAUSED
 *************************************************************************/
function processEmailUpdateCommands() {
  const result =
    getTodayEmailUpdateCommands();
  const commands =
    result.commands;
  if (!commands.length) {
    return {
      success: true,
      found: 0,
      executed: null,
      archived: 0,
      state: getEmailUpdatesState()
    };
  }
  /*
   * getTodayEmailUpdateCommands()
   * already sorts oldest -> newest.
   */
  const latest =
    commands[
      commands.length - 1
    ];
  /*
   * Do not consume a DISABLE command until
   * DISABLE behavior is actually implemented.
   */
  if (latest.command === 'DISABLE') {

    /*
     * Consume all recognized control messages first.
     *
     * Once polling is disabled, there may be no future
     * execution available to clean them up.
     */
    const archived =
      archiveEmailUpdateCommands(
        commands
      );

    /*
     * Store PAUSED as the safe state in case polling
     * is manually reinstalled later.
     */
    const state =
      setEmailUpdatesState(
        EMAIL_UPDATES_STATE_PAUSED
      );

    /*
     * Send confirmation BEFORE removing the trigger.
     */
    const subject =
      'Gmail Email Updates - POLLING DISABLED';

    const body =
      'Email polling has been disabled.\n\n' +
      'The hourly trigger has been removed.\n\n' +
      'Email commands will not be detected until polling is manually reinstalled.';

    GmailApp.sendEmail(
      getEmailUpdatesRecipient(),
      subject,
      body
    );

    /*
     * Remove only the Email Updates hourly trigger.
     */
    const triggerResult =
      removeEmailUpdatesTrigger();

    return {
      success: true,
      found: commands.length,
      executed: 'DISABLE',
      archived: archived,
      state: state,
      confirmation: {
        success: true,
        recipient:
          getEmailUpdatesRecipient(),
        subject: subject
      },
      triggerRemoved:
        triggerResult.removed
    };
  }
  /*
   * Archive all recognized commands BEFORE
   * changing state.
   */
  const archived =
    archiveEmailUpdateCommands(
      commands
    );
  let state;
  if (latest.command === 'ENABLE') {
    state =
      setEmailUpdatesState(
        EMAIL_UPDATES_STATE_ACTIVE
      );
  } else if (
    latest.command === 'PAUSE'
  ) {
    state =
      setEmailUpdatesState(
        EMAIL_UPDATES_STATE_PAUSED
      );
  } else {
    throw new Error(
      'Unexpected command: ' +
      latest.command
    );
  }
  /*
   * Send immediate confirmation after the command
   * has been successfully applied.
   */
  const confirmation =
    sendEmailUpdatesStateConfirmation(
      state
    );

  return {
    success: true,
    found: commands.length,
    executed: latest.command,
    archived: archived,
    state: state,
    confirmation: confirmation
  };
}
/*************************************************************************
 * CONTROL COMMAND PROCESSING TEST
 *
 * THIS TEST:
 *
 *   WILL archive recognized control messages.
 *   WILL set ACTIVE/PAUSED state.
 *
 * IT WILL NOT:
 *
 *   send snapshot emails
 *   install triggers
 *   remove triggers
 *************************************************************************/
function testProcessEmailUpdateCommands() {
  const result =
    processEmailUpdateCommands();
  console.log('');
  console.log(
    '===== EMAIL UPDATE COMMAND PROCESSING ====='
  );
  console.log(
    `Found: ${result.found}`
  );
  console.log(
    `Executed: ${result.executed || 'NONE'}`
  );
  console.log(
    `Archived: ${result.archived}`
  );
  console.log(
    `State: ${result.state}`
  );
  if (result.pendingCommand) {
    console.log(
      `Pending: ${result.pendingCommand}`
    );
  }
  if (result.message) {
    console.log(
      result.message
    );
  }
  console.log(
    '===== COMPLETE ====='
  );
  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
  return result;
}
/*************************************************************************
 * READ-ONLY COMMAND PREVIEW
 *
 * This function:
 *
 *   DOES NOT archive anything
 *   DOES NOT send email
 *   DOES NOT create/delete triggers
 *   DOES NOT change state
 *************************************************************************/
function previewEmailUpdateCommands() {
  const result =
    getTodayEmailUpdateCommands();
  console.log('');
  console.log(
    '===== EMAIL UPDATE COMMAND PREVIEW ====='
  );
  console.log(
    `Search: ${result.query}`
  );
  console.log(
    `Recognized commands: ${result.commands.length}`
  );
  console.log('');
  for (
    let i = 0;
    i < result.commands.length;
    i++
  ) {
    const item =
      result.commands[i];
    console.log(
      `COMMAND ${i + 1}`
    );
    console.log(
      `Type: ${item.command}`
    );
    console.log(
      `Subject: ${item.subject}`
    );
    console.log(
      `From: ${item.from}`
    );
    console.log(
      `Date: ${item.date}`
    );
    console.log(
      `Message ID: ${item.messageId}`
    );
    console.log('');
  }
  const latest =
    result.commands.length
      ? result.commands[
          result.commands.length - 1
        ]
      : null;
  if (latest) {
    console.log(
      'LATEST COMMAND THAT WOULD EXECUTE:'
    );
    console.log(
      `${latest.command} - ${latest.subject}`
    );
  } else {
    console.log(
      'NO COMMAND WOULD EXECUTE'
    );
  }
  console.log('');
  console.log(
    'READ ONLY - NO CHANGES MADE'
  );
  console.log(
    '===== COMPLETE ====='
  );
  return {
    success: true,
    recognized:
      result.commands.length,
    latestCommand:
      latest
        ? latest.command
        : null,
    latestSubject:
      latest
        ? latest.subject
        : null
  };
}
/*************************************************************************
 * BUILD TODAY'S UNREAD INBOX SNAPSHOT
 *
 * READ ONLY.
 *
 * Finds messages that are:
 *
 *   - currently in Inbox
 *   - currently unread
 *   - received during today's calendar day
 *
 * Results are returned newest first.
 *
 * No message bodies are retrieved.
 *************************************************************************/
function getTodayUnreadInboxMessages() {
  const query =
    'in:inbox is:unread newer_than:1d';
  const messageIds =
    searchGmailIds(query);
  const messages = [];
  for (const messageId of messageIds) {
    const message =
      Gmail.Users.Messages.get(
        'me',
        messageId,
        {
          format: 'metadata',
          metadataHeaders: [
            'From',
            'Subject',
            'Date'
          ]
        }
      );
    const headers =
      message.payload &&
      message.payload.headers
        ? message.payload.headers
        : [];
    const from =
      getEmailUpdateHeader(
        headers,
        'From'
      );
    const subject =
      getEmailUpdateHeader(
        headers,
        'Subject'
      );
    const dateHeader =
      getEmailUpdateHeader(
        headers,
        'Date'
      );
    const timestamp =
      message.internalDate
        ? Number(message.internalDate)
        : Date.parse(dateHeader);
    /*
    * Gmail search only provides candidates.
    * Our own timezone-aware check defines "today".
    */
    if (
      !isEmailUpdateTimestampToday(
        timestamp
      )
    ) {
      continue;
    }
    messages.push({
      messageId: messageId,
      from: from,
      subject: subject,
      timestamp: timestamp,
      date: new Date(timestamp)
    });
  }
  /*
   * Newest first.
   */
  messages.sort(
    (a, b) =>
      b.timestamp - a.timestamp
  );
  return {
    success: true,
    query: query,
    messages: messages
  };
}
/*************************************************************************
 * FORMAT SNAPSHOT
 *
 * Produces the same basic text that will eventually
 * be emailed in the hourly snapshot.
 *************************************************************************/
function formatEmailUpdateSnapshot(
  messages
) {
  const timeZone =
    Session.getScriptTimeZone();
  const now =
    Utilities.formatDate(
      new Date(),
      timeZone,
      'MMM d, yyyy h:mm a'
    );
  const lines = [];
  lines.push(
    'Unread Inbox Snapshot'
  );
  lines.push(
    'Generated: ' + now
  );
  lines.push(
    'Unread today: ' +
    messages.length
  );
  lines.push('');
  lines.push(
    '------------------------------'
  );
  lines.push('');
  if (!messages.length) {
    lines.push(
      'No unread Inbox messages received today.'
    );
    return lines.join('\n');
  }
  for (
    let i = 0;
    i < messages.length;
    i++
  ) {
    const item =
      messages[i];
    const date =
      Utilities.formatDate(
        item.date,
        timeZone,
        'h:mm a'
      );
    lines.push(
      `${i + 1}. ${item.from}`
    );
    lines.push(
      `   ${item.subject || '(No Subject)'}`
    );
    lines.push(
      `   ${date}`
    );
    lines.push('');
  }
  return lines.join('\n');
}
/*************************************************************************
 * READ-ONLY SNAPSHOT PREVIEW
 *
 * DOES NOT:
 *
 *   send email
 *   archive email
 *   mark anything read
 *   apply labels
 *   create/remove triggers
 *************************************************************************/
function previewEmailUpdateSnapshot() {
  const result =
    getTodayUnreadInboxMessages();
  const snapshot =
    formatEmailUpdateSnapshot(
      result.messages
    );
  console.log('');
  console.log(
    '===== EMAIL UPDATE SNAPSHOT PREVIEW ====='
  );
  console.log(
    `Search: ${result.query}`
  );
  console.log(
    `Unread today: ${result.messages.length}`
  );
  console.log('');
  console.log(snapshot);
  console.log('');
  console.log(
    'READ ONLY - NO CHANGES MADE'
  );
  console.log(
    '===== COMPLETE ====='
  );
  return {
    success: true,
    unreadToday:
      result.messages.length,
    snapshot: snapshot
  };
}
/*************************************************************************
 * SAFE SNAPSHOT TEST
 *************************************************************************/
function testPreviewEmailUpdateSnapshot() {
  console.log(
    JSON.stringify(
      previewEmailUpdateSnapshot(),
      null,
      2
    )
  );
}
/*************************************************************************
 * SAFE TEST
 *************************************************************************/
function testPreviewEmailUpdateCommands() {
  console.log(
    JSON.stringify(
      previewEmailUpdateCommands(),
      null,
      2
    )
  );
}

/*************************************************************************
 * SEND EMAIL UPDATE SNAPSHOT
 *
 * Sends the current unread-today Inbox snapshot to the authorized
 * control address.
 *
 * This function does NOT:
 *   - process control commands
 *   - change ACTIVE/PAUSED state
 *   - install/remove triggers
 *   - archive or modify Inbox messages
 *************************************************************************/

function sendEmailUpdateSnapshot() {

  const result =
    getTodayUnreadInboxMessages();

  const snapshot =
    formatEmailUpdateSnapshot(
      result.messages
    );

  const timeZone =
    Session.getScriptTimeZone();

  const generated =
    Utilities.formatDate(
      new Date(),
      timeZone,
      'MMM d, yyyy h:mm a'
    );

  const subject =
    'Gmail Inbox Update - ' +
    result.messages.length +
    ' unread today';

  GmailApp.sendEmail(
    getEmailUpdatesRecipient(),
    subject,
    snapshot
  );

  return {
    success: true,
    recipient:
      getEmailUpdatesRecipient(),
    subject: subject,
    generated: generated,
    unreadToday:
      result.messages.length
  };
}


/*************************************************************************
 * MANUAL SNAPSHOT SEND TEST
 *
 * THIS TEST WILL SEND ONE REAL EMAIL.
 *
 * It will NOT:
 *   - modify Inbox messages
 *   - process commands
 *   - change state
 *   - install/remove triggers
 *************************************************************************/

function testSendEmailUpdateSnapshot() {

  const result =
    sendEmailUpdateSnapshot();

  console.log('');
  console.log(
    '===== EMAIL UPDATE SNAPSHOT SENT ====='
  );

  console.log(
    `Recipient: ${result.recipient}`
  );

  console.log(
    `Subject: ${result.subject}`
  );

  console.log(
    `Unread today: ${result.unreadToday}`
  );

  console.log(
    `Generated: ${result.generated}`
  );

  console.log(
    '===== COMPLETE ====='
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

/*************************************************************************
 * EMAIL UPDATES TRIGGER MANAGEMENT
 *
 * Only manages triggers whose handler is:
 *
 *   runEmailUpdatesHourly
 *
 * It does not touch any other project triggers.
 *************************************************************************/

function removeEmailUpdatesTrigger() {

  const triggers =
    ScriptApp.getProjectTriggers();

  let removed = 0;

  for (const trigger of triggers) {

    if (
      trigger.getHandlerFunction() ===
      'runEmailUpdatesHourly'
    ) {

      ScriptApp.deleteTrigger(
        trigger
      );

      removed++;
    }
  }

  return {
    success: true,
    removed: removed
  };
}


function installEmailUpdatesTrigger() {

  /*
   * Remove any existing copies first so there can
   * never be duplicate Email Updates triggers.
   */
  const cleanup =
    removeEmailUpdatesTrigger();

  /*
   * A manual reinstall starts safely in PAUSED mode.
   */
  setEmailUpdatesState(
    EMAIL_UPDATES_STATE_PAUSED
  );

  const trigger =
    ScriptApp
      .newTrigger(
        'runEmailUpdatesHourly'
      )
      .timeBased()
      .everyHours(1)
      .create();

  return {
    success: true,
    triggerId:
      trigger.getUniqueId(),
    removedExisting:
      cleanup.removed,
    state:
      EMAIL_UPDATES_STATE_PAUSED
  };
}

/*************************************************************************
 * EMAIL UPDATES HOURLY HANDLER
 *
 * Hourly execution path.
 *
 * Order:
 *
 *   1. Process pending control commands.
 *   2. DISABLE -> remove polling trigger and stop this execution.
 *   3. Read current ACTIVE/PAUSED state.
 *   4. ACTIVE -> send snapshot.
 *   5. PAUSED -> send nothing.
 *************************************************************************/

function runEmailUpdatesHourly() {

  const commandResult =
    processEmailUpdateCommands();

  /*
   * DISABLE removes the polling trigger and ends
   * this execution without sending a snapshot.
   */
  if (
    commandResult.executed ===
    'DISABLE'
  ) {

    return {
      success: true,
      command: 'DISABLE',
      state:
        commandResult.state,
      snapshotSent: false,
      triggerRemoved:
        commandResult.triggerRemoved
    };
  }

  const state =
    getEmailUpdatesState();

  /*
   * PAUSED means polling continues but no snapshot is sent.
   */
  if (
    state ===
    EMAIL_UPDATES_STATE_PAUSED
  ) {

    return {
      success: true,
      command:
        commandResult.executed,
      state: state,
      snapshotSent: false
    };
  }

  /*
   * ACTIVE means send the current unread-today snapshot.
   */
  if (
    state ===
    EMAIL_UPDATES_STATE_ACTIVE
  ) {

    const snapshotResult =
      sendEmailUpdateSnapshot();

    return {
      success: true,
      command:
        commandResult.executed,
      state: state,
      snapshotSent: true,
      snapshot:
        snapshotResult
    };
  }

  throw new Error(
    'Unexpected Email Updates state: ' +
    state
  );
}


/*************************************************************************
 * MANUAL HOURLY HANDLER TEST
 *
 * IMPORTANT:
 *
 * This runs the REAL handler logic.
 *
 * It MAY:
 *   - archive recognized control messages
 *   - change ACTIVE/PAUSED state
 *   - send one snapshot if state is ACTIVE
 *   - execute DISABLE
 *   - remove the Email Updates trigger if DISABLE is processed
 *
 * It WILL NOT:
 *   - install a trigger
 *************************************************************************/

function testRunEmailUpdatesHourly() {

  const result =
    runEmailUpdatesHourly();

  console.log('');
  console.log(
    '===== EMAIL UPDATES HOURLY TEST ====='
  );

  console.log(
    `Command: ${result.command || 'NONE'}`
  );

  console.log(
    `State: ${result.state}`
  );

  console.log(
    `Snapshot sent: ${result.snapshotSent}`
  );

  if (result.message) {
    console.log(
      result.message
    );
  }

  console.log(
    '===== COMPLETE ====='
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}