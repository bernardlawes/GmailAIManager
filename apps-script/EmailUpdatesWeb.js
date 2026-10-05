/*************************************************************************
 * EMAIL UPDATES WEB RECOVERY ENDPOINT
 *
 * Provides a narrowly scoped recovery mechanism for restarting the
 * Email Updates hourly trigger after "Disable Email Polling".
 *
 * Security:
 *   - Requires a dedicated secret stored in Script Properties.
 *   - Does not expose Gmail data.
 *   - Does not accept arbitrary actions.
 *   - Always restarts in PAUSED mode.
 *************************************************************************/

const EMAIL_UPDATES_WEB_SECRET_KEY =
  'EMAIL_UPDATES_WEB_SECRET';


/*************************************************************************
 * WEB APP ENTRY POINT
 *************************************************************************/

function doGet(e) {

  try {

    const suppliedSecret =
      e &&
      e.parameter &&
      e.parameter.key
        ? String(e.parameter.key)
        : '';

    const expectedSecret =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          EMAIL_UPDATES_WEB_SECRET_KEY
        );

    if (!expectedSecret) {

      return emailUpdatesWebResponse(
        'Email Polling Recovery',
        'Recovery is not configured.'
      );
    }

    if (
      !suppliedSecret ||
      suppliedSecret !== expectedSecret
    ) {

      return emailUpdatesWebResponse(
        'Email Polling Recovery',
        'Unauthorized request.'
      );
    }

    /*
     * installEmailUpdatesTrigger() guarantees:
     *
     *   - exactly one runEmailUpdatesHourly trigger
     *   - state is PAUSED
     */
    const result =
      installEmailUpdatesTrigger();

    /*
     * Independent confirmation that the recovery
     * request actually succeeded.
     */
    GmailApp.sendEmail(
      getEmailUpdatesRecipient(),
      'Gmail Email Polling - RESTARTED',
      'Email polling has been restarted.\n\n' +
      'State: PAUSED\n' +
      'Hourly polling: ACTIVE\n' +
      'Inbox snapshots: PAUSED\n\n' +
      'Send "Enable Email Updates" to activate snapshots.'
    );

    return emailUpdatesWebResponse(
      'Email Polling Restarted',
      'Email polling has been restarted successfully.\n\n' +
      'State: PAUSED\n' +
      'Hourly polling: ACTIVE\n' +
      'Inbox snapshots: PAUSED\n\n' +
      'A confirmation email has been sent.'
    );

  } catch (error) {

    console.error(
      'Email Updates recovery failed:',
      error
    );

    return emailUpdatesWebResponse(
      'Email Polling Recovery Failed',
      'Email polling could not be restarted.'
    );
  }
}


/*************************************************************************
 * SIMPLE HUMAN-READABLE RESPONSE
 *************************************************************************/

function emailUpdatesWebResponse(
  title,
  message
) {

  const safeTitle =
    escapeEmailUpdatesWebHtml(
      title
    );

  const safeMessage =
    escapeEmailUpdatesWebHtml(
      message
    ).replace(
      /\n/g,
      '<br>'
    );

  const html =
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta name="viewport" ' +
    'content="width=device-width, initial-scale=1">' +
    '<title>' +
    safeTitle +
    '</title>' +
    '</head>' +

    '<body style="' +
    'font-family:Arial,sans-serif;' +
    'max-width:600px;' +
    'margin:60px auto;' +
    'padding:24px;' +
    'line-height:1.6;' +
    '">' +

    '<h2>' +
    safeTitle +
    '</h2>' +

    '<p>' +
    safeMessage +
    '</p>' +

    '</body>' +
    '</html>';

  return HtmlService
    .createHtmlOutput(
      html
    )
    .setTitle(
      title
    );
}


function escapeEmailUpdatesWebHtml(
  value
) {

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}