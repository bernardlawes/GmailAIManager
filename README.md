# Gmail AI Manager

Gmail AI Manager is a local-first Gmail management system that combines deterministic Gmail automation with AI-assisted inbox analysis.

It is designed around a simple principle:

> AI observes, reasons, and recommends. Deterministic code executes Gmail changes.

The system supports Gmail cleanup rules, protected senders, account-specific label taxonomies, agentic inbox management, persistent sender automation, and remotely controlled email snapshots.

## Architecture

```text
AI / Codex
    |
    v
Local PowerShell Bridge
127.0.0.1:8765
    |
    v
Google Apps Script Web API
    |
    v
Gmail AI Manager
    |
    +--> Gmail
    |
    +--> Google Sheet
          DELETE
          PROTECTED
          ISSUES
          AUTO
```

The local bridge is the security boundary between AI tools and Gmail.

AI does not receive the Apps Script API key and does not directly execute Gmail operations. Gmail changes are performed by deterministic Apps Script functions after validation.

## Features

- Sender-based Gmail cleanup rules
- Protected-sender exceptions
- Native Gmail filter generation
- Account-specific Gmail label taxonomies
- MAIN, WORK, and SIMPLE account profiles
- Read-only inbox inspection for AI analysis
- One-time thread labeling and archiving
- Persistent AUTO rules for future messages
- Human approval before consequential Gmail actions
- Hourly unread Inbox snapshots
- Email-based Enable, Pause, and Disable controls
- Recovery URL for restarting disabled Email Updates
- Local Windows credential storage using DPAPI
- Installation-specific configuration stored outside source code

## Repository Structure

```text
GmailAIManager/
|
+-- AGENTS.md
+-- README.md
+-- powershell/
|   +-- GmailAI.ps1
|   +-- GmailAIBridge.ps1
|
+-- apps-script/
    +-- Analyze.js
    +-- appsscript.json
    +-- ArchiveAPI.js
    +-- AutoAPI.js
    +-- Code.js
    +-- Config.js
    +-- EmailUpdates.js
    +-- EmailUpdatesWeb.js
    +-- Filters.js
    +-- FiltersLabeled.js
    +-- Gmail.js
    +-- InboxAPI.js
    +-- Labels.js
    +-- RuleAPI.js
    +-- WebAPI.js
```

`.clasp.json`, credentials, API keys, recovery secrets, logs, and other installation-specific files are intentionally excluded from Git.

## Requirements

### Google

- Gmail account
- Google Apps Script
- Google Sheets
- Gmail Advanced Service enabled in the Apps Script project
- Apps Script API enabled for the Google account

Enable the Apps Script API before using `clasp`:

`https://script.google.com/home/usersettings`

### Local Environment

The current local tooling is designed for Windows and PowerShell.

Required:

- PowerShell
- Node.js
- npm
- Git
- Google `clasp`

Install `clasp` globally:

```powershell
npm install -g @google/clasp
```

Verify:

```powershell
clasp.cmd --version
```

Then authenticate:

```powershell
clasp.cmd login
```

## Security Model

Gmail AI Manager deliberately separates configuration, credentials, AI reasoning, and Gmail execution.

Installation-specific configuration such as account type and Email Updates addresses is stored in Apps Script Script Properties rather than committed source code.

Secrets are also stored outside the repository:

- `GMAIL_CLEANUP_API_KEY`
- `EMAIL_UPDATES_WEB_SECRET`

The local PowerShell bridge stores its Apps Script credentials using Windows DPAPI under the user's local application data directory.

The Apps Script Web App is externally reachable because Apps Script must receive bridge and recovery requests. Application-level secrets authenticate those requests before Gmail operations are dispatched.

Consequential Gmail actions should require explicit user approval unless the user has intentionally configured persistent automation.


## Installation

### 1. Create the Google Sheet and Apps Script Project

Create a Google Sheet named:

```text
Gmail AI Manager
```

Open:

```text
Extensions -> Apps Script
```

This creates the container-bound Apps Script project that will run Gmail AI Manager.

Keep the Apps Script project available because its Script ID is required when connecting the local source with `clasp`.

### 2. Connect the Local Source with clasp

From the repository's `apps-script` directory:

```powershell
cd apps-script
clasp.cmd login
```

Create the local `.clasp.json` for this installation using the Script ID from the Apps Script project.

Do not commit `.clasp.json`. It is intentionally excluded from Git because it identifies a specific Apps Script installation.

Once connected, push the source:

```powershell
clasp.cmd push
```

On the first push, `clasp` may ask whether to overwrite the Apps Script manifest. Review the project and answer `y` when installing this repository's audited manifest.

If `clasp` reports:

```text
Request contains an invalid argument
```

verify the Script ID first. A mistyped Script ID can produce this error.

### 3. Verify the Apps Script Project

The included `appsscript.json` enables the Gmail Advanced Service required by Gmail AI Manager.

The project timezone is also defined in the Apps Script manifest. Review it for the installation and change it if necessary.

The timezone matters for features such as Email Updates that determine which messages were received "today."

### 4. Configure the Installation

Gmail AI Manager supports three account profiles:

- `MAIN` - full personal Gmail taxonomy
- `WORK` - work-oriented taxonomy
- `SIMPLE` - lightweight general-purpose taxonomy

Installation-specific configuration is stored in Apps Script Script Properties rather than source code.

In the Apps Script editor, run:

```javascript
configureGmailAIManager(
  'MAIN',
  'authorized-command-sender@example.com',
  'snapshot-recipient@example.com'
);
```

Replace the three values with the configuration for this installation.

The arguments are:

```text
accountType
authorizedSender
recipient
```

`authorizedSender` is the exact email address permitted to send Email Updates control commands.

`recipient` is the address that receives Email Updates snapshots and state confirmations.

These addresses may be the same or different.

Valid account types are:

```text
MAIN
WORK
SIMPLE
```

`configureGmailAIManager()` stores the installation configuration in Script Properties and initializes missing application state without resetting existing state.

It does not generate API or recovery secrets.

### 5. Existing Gmail Accounts

Before creating the canonical Gmail AI Manager labels, inspect the account for existing user-created labels that conflict with the selected taxonomy.

Do not rename or reorganize Gmail system labels.

For an established Gmail account with many existing custom labels, one migration option is to create a top-level label such as:

```text
OLD
```

and manually move legacy user-created labels beneath it before setup.

This preserves the old label hierarchy while freeing canonical names for Gmail AI Manager.

This step is optional and should only be performed when existing labels conflict with the selected account profile.

### 6. Initialize Gmail AI Manager

After configuration is complete, run:

```javascript
setupGmailAIManager();
```

Setup validates and initializes the required Google Sheet tabs:

```text
DELETE
PROTECTED
ISSUES
AUTO
```

It also creates the canonical Gmail labels for the configured account profile.

Setup validates existing structures before making changes so configuration problems can be identified before initialization proceeds.

### 7. Generate the API Secret

Run:

```javascript
generateApiKey();
```

Store the generated value securely.

The API key authenticates requests sent through the local PowerShell bridge to the Apps Script Web API.

Do not place this key in:

- source code
- `README.md`
- `.clasp.json`
- Git
- AI prompts or conversations

### 8. Generate the Email Updates Recovery Secret

Run:

```javascript
generateEmailUpdatesWebSecret();
```

Store this value securely as well.

This secret authenticates the recovery Web App request used to restart Email Updates after polling has been completely disabled.

Do not commit or publish this secret.

### 9. Install Email Updates Polling

Run:

```javascript
installEmailUpdatesTrigger();
```

This creates the hourly Email Updates trigger and initializes Email Updates in:

```text
PAUSED
```

state.

The Email Updates states are:

```text
ACTIVE
    Hourly polling and hourly unread-Inbox snapshots

PAUSED
    Hourly command polling continues, but snapshots are not sent

DISABLED
    Polling trigger is removed completely
```

### 10. Deploy the Apps Script Web App

In the Apps Script editor:

```text
Deploy -> New deployment
```

Choose:

```text
Web app
```

Deploy the application using the required execution and access settings from the included Apps Script configuration.

After deployment, save the Web App URL.

The Web App exposes two authenticated entry paths:

- POST requests used by the local bridge
- GET requests used by the Email Updates recovery mechanism

Although the Web App is externally reachable, requests must pass the application's secret validation before Gmail operations are dispatched.

### 11. Configure the Local PowerShell Bridge

Return to the repository root and run:

```powershell
.\powershell\GmailAI.ps1 -Action setup
```

Provide the deployed Web App URL and API key when prompted.

The credentials are stored locally using Windows DPAPI rather than in the repository.

Do not add them to source files.

### 12. Start the Local Bridge

Run:

```powershell
.\powershell\GmailAIBridge.ps1
```

The bridge listens locally on:

```text
http://127.0.0.1:8765/rules
```

The bridge injects the API credential into authenticated Apps Script requests so AI tooling does not need access to the secret itself.

If the bridge is unavailable, Gmail AI Manager's local execution path fails closed rather than bypassing the bridge.

## Email Updates

Email Updates provides a lightweight remote-control mechanism for receiving hourly summaries of unread Inbox messages received during the current calendar day.

### States

Email Updates has three operational states:

| State    | Polling | Snapshots |
| ---      | ---     | ---       |
| ACTIVE   | Yes     | Yes       |
| PAUSED   | Yes     | No        |
| DISABLED | No      | No        |

### Control Commands

Commands must be sent from the exact address configured as the installation's `authorizedSender`.

The recognized email subjects are:

```text
Enable Email Updates
Pause Email Updates
Disable Email Polling
```

Subject matching is exact.

The command processor treats today's Inbox as the pending command queue. When multiple recognized commands are present, the newest recognized command wins.

Recognized command messages are archived after processing. Unrecognized messages are ignored.

#### Enable Email Updates

```text
Enable Email Updates
```

Sets the state to `ACTIVE`.

Hourly polling continues and unread-Inbox snapshots are sent to the configured recipient.

#### Pause Email Updates

```text
Pause Email Updates
```

Sets the state to `PAUSED`.

Hourly polling remains active so future commands can still be received, but Inbox snapshots are not sent.

#### Disable Email Polling

```text
Disable Email Polling
```

Removes the hourly polling trigger completely.

Because command polling is no longer running, email commands cannot restart the system from `DISABLED`.

The recovery Web App must be used instead.

### Inbox Snapshots

When Email Updates is `ACTIVE`, each hourly run sends a snapshot containing all messages that are:

- currently unread
- currently in the Inbox
- received during the current local calendar day

Unread messages may therefore appear in multiple hourly snapshots until they are read or leave the Inbox.

The Apps Script project's timezone determines the local calendar day.

### Recovery from DISABLED

The recovery endpoint provides one narrowly scoped operation: reinstall Email Updates polling.

Its URL has this form:

```text
<WEB_APP_URL>?key=<EMAIL_UPDATES_WEB_SECRET>
```

For example:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?key=YOUR_RECOVERY_SECRET
```

Use the actual Web App URL created during deployment and the secret generated by:

```javascript
generateEmailUpdatesWebSecret();
```

Keep the completed recovery URL private. Anyone possessing both the Web App URL and recovery secret can invoke the recovery operation.

A successful recovery:

1. removes any existing Email Updates polling trigger
2. installs exactly one hourly polling trigger
3. sets Email Updates to `PAUSED`
4. leaves Inbox snapshots disabled
5. sends a restart confirmation to the configured recipient

After recovery, send:

```text
Enable Email Updates
```

from the configured authorized sender if snapshots should resume.

Recovery deliberately does not return the system directly to `ACTIVE`.

## Updating an Existing Installation

The local repository should remain the source of truth for Apps Script source code.

After making and reviewing local changes:

```powershell
cd apps-script
clasp.cmd push
```

A successful push updates the Apps Script project source.

If the change affects Web App execution, create a new Web App deployment version:

```text
Deploy -> New deployment
```

Use a descriptive version label such as:

```text
V4
```

and deploy using the same Web App settings.

Verify the resulting Web App URL before assuming that it has remained unchanged.

Installation-specific values should not be copied back into source files. They remain in Script Properties and therefore survive normal `clasp push` operations.


## Gmail Rule Management

Gmail AI Manager separates permanent sender rules from one-time message actions.

### DELETE

The `DELETE` sheet contains sender-based rules for messages that should be automatically deleted.

DELETE rules are synchronized into native Gmail filters. Large rule sets are automatically split into multiple filters when necessary.

Protected-sender logic is applied when constructing the effective delete criteria.

### PROTECTED

The `PROTECTED` sheet contains senders that must be excluded from automated deletion.

Use PROTECTED for addresses that should remain safe even when broader DELETE criteria could otherwise match them.

### AUTO

The `AUTO` sheet contains persistent sender automation.

Each AUTO rule contains:

```text
Sender | Label | Archive
```

An AUTO rule applies to:

- existing Inbox messages from the exact sender
- future messages from that sender

AUTO rules can assign one canonical Gmail AI Manager label and optionally archive matching messages.

Native Gmail filters handle future messages. Gmail AI Manager also applies newly created AUTO rules to matching messages already in the Inbox.

Removing an AUTO rule stops future automation but does not undo actions previously performed.

### One-Time Actions vs AUTO Rules

These operations are intentionally different.

A one-time thread action:

```text
Label this message RECEIPTS and archive it.
```

affects only the selected Gmail thread.

A persistent AUTO instruction:

```text
Always label messages from sender@example.com as RECEIPTS and archive them.
```

creates sender-based automation that affects existing matching Inbox messages and future messages from that sender.

Approval of a one-time action does not imply approval to create an AUTO rule.

Before creating a persistent AUTO rule, the user should be explicitly informed that it will apply to all existing Inbox messages from that sender and future messages from that sender.

## AI-Assisted Inbox Review

The read-only Inbox API allows an AI agent to inspect Inbox metadata without granting the agent direct Gmail credentials.

Inbox observations can include:

- sender
- recipient
- subject
- date
- snippet
- Gmail labels
- thread ID
- message count

A normal review should follow this model:

```text
Gmail
  |
  v
Read-only observation
  |
  v
AI analysis
  |
  v
Recommendations
  |
  v
User approval
  |
  v
Deterministic Gmail action
```

Useful recommendation categories include:

```text
ATTENTION
ARCHIVE
LABEL
DELETE
PROTECT
AUTO
REVIEW / UNCERTAIN
```

The AI may recommend actions, but ordinary inbox review should not itself modify Gmail.

If there is insufficient evidence for a canonical label, the message can remain unlabeled or be placed into review rather than forcing a classification.

Archiving without assigning a label is valid.

## Local API Actions

The local bridge supports the Apps Script operations used by the AI workflow:

```text
getInboxThreads
applyThreadActions
applyRuleChanges
applyAutoRuleChanges
```

Their responsibilities are intentionally separated.

`getInboxThreads`

```text
Read-only Inbox observation.
```

`applyThreadActions`

```text
One-time operations on specific Gmail threads.
```

`applyRuleChanges`

```text
Changes to DELETE and PROTECTED rules.
```

`applyAutoRuleChanges`

```text
Creation or removal of persistent sender AUTO rules.
```

The local bridge injects the API credential before forwarding these requests to Apps Script.

## Native Gmail Filters

Gmail AI Manager uses native Gmail filters for persistent automation rather than continuously polling Gmail for ordinary DELETE and AUTO processing.

Managed filters are tracked by Apps Script so synchronization only modifies filters owned by Gmail AI Manager.

DELETE filter ownership is stored in:

```text
GMAIL_CLEANUP_MANAGED_FILTER_IDS
```

AUTO/labeled filter ownership is stored in:

```text
GMAIL_AI_MANAGED_LABELED_FILTER_IDS
```

These properties are application-managed state.

Do not manually replace them with installation defaults after the system is operational.

Filter synchronization is designed to preserve unrelated Gmail filters that are not owned by Gmail AI Manager.

## Local PowerShell Tools

Gmail AI Manager includes two PowerShell components with different responsibilities.

### GmailAI.ps1

`GmailAI.ps1` provides setup and direct DELETE/PROTECTED rule management.

Configure the local installation:

```powershell
.\powershell\GmailAI.ps1 -Action setup
```

The script prompts for:

```text
Apps Script Web App URL
API key
```

Local configuration is stored under:

```text
%LOCALAPPDATA%\GmailAIManager
```

The Web App URL and protected API credential are therefore kept outside the Git repository.

Supported rule-management actions are:

```text
setup
add-delete
remove-delete
add-protected
remove-protected
```

Example:

```powershell
.\powershell\GmailAI.ps1 -Action add-delete -Value "sender@example.com"
```

The script converts the requested operation into an authenticated `applyRuleChanges` request to the Apps Script Web App.

### GmailAIBridge.ps1

`GmailAIBridge.ps1` is the local API boundary used by AI tooling.

Start it from the repository root:

```powershell
.\powershell\GmailAIBridge.ps1
```

It listens only on:

```text
http://127.0.0.1:8765/
```

and accepts Gmail AI Manager requests at:

```text
POST /rules
```

The bridge accepts only these application actions:

```text
applyRuleChanges
applyThreadActions
getInboxThreads
applyAutoRuleChanges
```

Requests with unsupported actions, unknown fields, invalid values, excessive batch sizes, incorrect HTTP methods, or unknown endpoints are rejected before forwarding.

The bridge then injects the stored API key and forwards exactly one validated transaction to the configured Apps Script Web App.

Stop the bridge with:

```text
Ctrl+C
```

### Read-Only Bridge Test

After starting the bridge, a safe read-only test can be performed from another PowerShell window:

```powershell
$body = @{
    action  = "getInboxThreads"
    options = @{
        maxResults = 5
        query      = ""
    }
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://127.0.0.1:8765/rules" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

A successful response should report:

```text
success: True
```

and return Inbox metadata.

`maxResults` must be between 1 and 100.

This test is read-only and does not label, archive, delete, or otherwise modify Gmail.