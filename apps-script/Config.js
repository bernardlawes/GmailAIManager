/*************************************************************************
 * GMAIL AI MANAGER - CONFIGURATION
 *
 * Installation-specific, non-secret configuration.
 *
 * DO NOT store API keys, recovery secrets, passwords, or other
 * credentials in this file.
 *************************************************************************/

const GMAIL_AI_CONFIG = {

  /*
   * Gmail AI Manager account profile.
   *
   * Supported values:
   *   MAIN
   *   WORK
   *   SIMPLE
   */
  accountType: 'SIMPLE',

  /*
   * Email Updates
   *
   * authorizedSender:
   *   Address permitted to send remote-control commands.
   *
   * recipient:
   *   Address that receives snapshots and confirmations.
   */
  emailUpdates: {

    authorizedSender: 'your-sender-email@example.com',

    recipient: 'your-recipient-email@example.com',

    commands: {
      enable: 'Enable Email Updates',
      pause: 'Pause Email Updates',
      disable: 'Disable Email Polling'
    }

  }

};