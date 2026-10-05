/*************************************************************************
 * GMAIL AI MANAGER - CONFIGURATION
 *
 * Installation-specific configuration is stored in Apps Script
 * Script Properties so source updates cannot overwrite an installed
 * account's configuration.
 *************************************************************************/

const GMAIL_AI_ACCOUNT_TYPE_KEY =
  'GMAIL_AI_ACCOUNT_TYPE';

const EMAIL_UPDATES_AUTHORIZED_SENDER_KEY =
  'EMAIL_UPDATES_AUTHORIZED_SENDER';

const EMAIL_UPDATES_RECIPIENT_KEY =
  'EMAIL_UPDATES_RECIPIENT';


/*************************************************************************
 * GET REQUIRED CONFIGURATION PROPERTY
 *************************************************************************/

function getRequiredConfigProperty(name) {

  const value =
    PropertiesService
      .getScriptProperties()
      .getProperty(name);

  if (!value || !value.trim()) {

    throw new Error(
      'Missing required Script Property: ' +
      name
    );

  }

  return value.trim();

}


/*************************************************************************
 * GET GMAIL AI MANAGER CONFIGURATION
 *************************************************************************/

function getGmailAIConfig() {

  return {

    accountType:
      getRequiredConfigProperty(
        GMAIL_AI_ACCOUNT_TYPE_KEY
      ),

    emailUpdates: {

      authorizedSender:
        getRequiredConfigProperty(
          EMAIL_UPDATES_AUTHORIZED_SENDER_KEY
        ),

      recipient:
        getRequiredConfigProperty(
          EMAIL_UPDATES_RECIPIENT_KEY
        ),

      commands: {
        enable: 'Enable Email Updates',
        pause: 'Pause Email Updates',
        disable: 'Disable Email Polling'
      }

    }

  };

}


/*************************************************************************
 * CONFIGURE GMAIL AI MANAGER
 *
 * Installation helper.
 *
 * Stores installation-specific configuration in Script Properties.
 * Existing application-managed state is never reset.
 *************************************************************************/

function configureGmailAIManager(
  accountType,
  authorizedSender,
  recipient
) {

  const validAccountTypes = [
    'MAIN',
    'WORK',
    'SIMPLE'
  ];

  const normalizedAccountType =
    String(accountType || '')
      .trim()
      .toUpperCase();

  const normalizedSender =
    String(authorizedSender || '')
      .trim()
      .toLowerCase();

  const normalizedRecipient =
    String(recipient || '')
      .trim()
      .toLowerCase();


  if (
    !validAccountTypes.includes(
      normalizedAccountType
    )
  ) {

    throw new Error(
      'Invalid account type. ' +
      'Expected MAIN, WORK, or SIMPLE.'
    );

  }


  if (!normalizedSender) {

    throw new Error(
      'Authorized sender is required.'
    );

  }


  if (!normalizedRecipient) {

    throw new Error(
      'Email Updates recipient is required.'
    );

  }


  const properties =
    PropertiesService.getScriptProperties();


  /*
   * Installation-specific configuration.
   */

  properties.setProperties({
    [GMAIL_AI_ACCOUNT_TYPE_KEY]:
      normalizedAccountType,

    [EMAIL_UPDATES_AUTHORIZED_SENDER_KEY]:
      normalizedSender,

    [EMAIL_UPDATES_RECIPIENT_KEY]:
      normalizedRecipient
  });


  /*
   * Initialize application-managed state only when missing.
   * Never reset existing ownership/state information.
   */

  if (
    properties.getProperty(
      'EMAIL_UPDATES_STATE'
    ) === null
  ) {

    properties.setProperty(
      'EMAIL_UPDATES_STATE',
      'PAUSED'
    );

  }


  if (
    properties.getProperty(
      'GMAIL_CLEANUP_MANAGED_FILTER_IDS'
    ) === null
  ) {

    properties.setProperty(
      'GMAIL_CLEANUP_MANAGED_FILTER_IDS',
      '[]'
    );

  }


  if (
    properties.getProperty(
      'GMAIL_AI_MANAGED_LABELED_FILTER_IDS'
    ) === null
  ) {

    properties.setProperty(
      'GMAIL_AI_MANAGED_LABELED_FILTER_IDS',
      '[]'
    );

  }


  return {
    success: true,
    accountType: normalizedAccountType,
    authorizedSender: normalizedSender,
    recipient: normalizedRecipient
  };

}