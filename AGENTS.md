# Gmail AI Manager

This project provides a local bridge for managing Gmail through natural-language requests, including cleanup rules, read-only inbox review, labeling, and archiving.

## Gmail rule requests

When the user asks to add, remove, protect, or stop protecting Gmail senders or domains, use the local Gmail AI Manager bridge.

Endpoint:

http://127.0.0.1:8765/rules

Use PowerShell to send a JSON POST request.

## Request format

For DELETE and PROTECTED rule management, use the `applyRuleChanges`
action.

The bridge request must contain `"action": "applyRuleChanges"` and one
`changes` object containing any combination of these four operations:

{
  "action": "applyRuleChanges",
  "changes": {
    "addDelete": [],
    "removeDelete": [],
    "addProtected": [],
    "removeProtected": []
  }
}

Multiple operation types MAY and SHOULD be combined into a single request.

## Natural-language mapping

Interpret requests as follows:

- "Add X to my permanent delete list" -> addDelete
- "Delete mail from X permanently" -> addDelete
- "Remove X from my permanent delete list" -> removeDelete
- "Protect X" -> addProtected
- "Never delete X" -> addProtected
- "Stop protecting X" -> removeProtected
- "Remove X from protected" -> removeProtected

## Execution rules

1. Combine ALL Gmail rule changes in the user's request into ONE request to the localhost bridge.

2. Different operation types must also be combined. For example, adding a domain to DELETE while protecting one sender within that domain is ONE request.

3. When multiple senders or domains are supplied, place them in the appropriate arrays.

4. Do not call Gmail directly for these rule-management requests.

5. Do not modify the Google Sheet directly. The Apps Script backend is the authoritative rule-management layer.

6. Do not read, request, display, copy, or modify the Gmail AI Manager API key or credential files.

7. Do not access the Apps Script Web App directly. Communicate only with the localhost bridge.

8. Do not modify GmailAIBridge.ps1, GmailAI.ps1, AGENTS.md, or other project files when executing an ordinary Gmail rule request.

9. Do not invent, correct, expand, or alter sender addresses or domain names supplied by the user. Send values exactly as provided.

10. If a sender or domain appears malformed or ambiguous, ask the user before executing the request.

11. Report the bridge response after execution, including each change and whether synchronization completed.

12. If the localhost bridge is unavailable, report that Gmail AI Manager is not running. Do not attempt an alternative path that bypasses the bridge.

13. The localhost `/rules` endpoint is POST-only. Never send GET, HEAD, OPTIONS, or connectivity/probe requests to it. When executing a Gmail DELETE/PROTECTED rule change, send exactly one POST request containing `"action": "applyRuleChanges"` and the complete `changes` object.

14. Do not test or probe the Apps Script Web App directly. The only network endpoint Codex should access for Gmail rule changes is http://127.0.0.1:8765/rules.

## Example

User:

Add example.com to my permanent delete list, but protect billing@example.com.

Send ONE request:

{
  "action": "applyRuleChanges",
  "changes": {
    "addDelete": ["example.com"],
    "removeDelete": [],
    "addProtected": ["billing@example.com"],
    "removeProtected": []
  }
}

Do not send two separate requests.

## Safety boundary

The localhost bridge is intentionally the only permitted execution path for Gmail rule changes.

Do not attempt to bypass its validation, access its credentials, broaden filesystem permissions, or substitute another Gmail-management mechanism.




## Agentic Inbox Review

Gmail AI Manager has two operating modes:

### 1. Explicit Rule Management

When the user explicitly asks to add or remove DELETE or PROTECTED
rules, use the existing local Gmail AI Manager bridge.

Examples:

- "Permanently delete mail from example.com"
- "Protect billing@example.com"
- "Remove example.com from my delete list"

The deterministic Gmail AI Manager system remains authoritative for
DELETE and PROTECTED rules.

### 2. Agentic Inbox Review

When the user asks to review, clean up, analyze, organize, or assess
their inbox, first operate in recommendation-only mode.

Inspect the requested Gmail messages and classify useful findings as:

### ATTENTION Triage

The purpose of ATTENTION review is to identify messages currently in the
inbox that plausibly require the user's attention, response, or action.

ATTENTION is not the same as "important."

Classify messages into these categories:

- REPLY
  A person or organization appears to be waiting for a response from the user.

- ACTION
  The user appears to need to do something other than reply.
  Examples include completing a form, scheduling, confirming something,
  paying something, signing something, reviewing a security event, or
  completing a requested task.

- REVIEW
  The message appears potentially important and worth reading, but there is
  insufficient evidence that a specific response or action is required.

- NO ACTION
  No apparent action is required.
  Examples include informational notifications, receipts, confirmations,
  newsletters, promotions, routine automated messages, and completed
  transactions.

For REPLY, ACTION, and REVIEW, also assign urgency:

- NOW
  There is evidence of a deadline, security concern, immediate request,
  expiring opportunity, or other meaningful time sensitivity.

- SOON
  The message reasonably deserves attention within the next few days.

- ROUTINE
  The message deserves attention, but there is no evidence of urgency.

### Reasoning Rules

Do not classify a message from its subject line alone when thread or message
content is available.

Inspect enough of the message or thread to understand what is actually being
requested and whether the user has already responded or completed the action.

Do not infer urgency merely from promotional language such as "urgent",
"important", "last chance", "action required", or similar wording.

Do not classify a message as ATTENTION merely because it comes from an
important sender.

Receipts, order confirmations, shipping notifications, newsletters,
promotions, social notifications, and routine automated messages should
normally be NO ACTION unless their actual content establishes a reason for
the user to act.

Security and account notifications should be evaluated from their actual
content. A security notification is not automatically ACTION if it merely
confirms an event and provides no evidence that intervention is required.

When evidence is ambiguous, prefer REVIEW rather than inventing an action.

### ATTENTION Output

Present actionable items first.

Follow the ATTENTION output format consistently.

Every REPLY, ACTION, or REVIEW item must explicitly include one of the
defined classifications and one of the defined urgency levels.

Do not substitute informal classifications such as "possible reply",
"review if relevant", or "conditional attention" for the defined
REPLY, ACTION, REVIEW, and urgency categories.

Do not create additional ATTENTION categories unless the user requests them.

Number each item so the user can refer to it naturally.

For each item report:

1. Classification and urgency
2. Sender
3. Subject
4. Date of the relevant/latest message
5. Why it needs attention
6. Suggested next action

Example:

1. REPLY · SOON
   TripleTen
   Subject: Following up
   Date: October 2

   Why: The recruiter asked whether the user is available for a conversation.
   Suggested action: Reply with availability.

Keep explanations concise.

Do not overwhelm the ATTENTION list with NO ACTION messages.

After the ATTENTION list, summarize excluded mail compactly, for example:

NO ACTION: 31
REVIEW: 4

Do not modify Gmail during ATTENTION review.

Do not send replies, archive messages, delete messages, create rules, add
labels, or otherwise modify Gmail unless the user subsequently gives explicit
approval for an action supported by an approved tool.

PROTECT
Senders or domains that appear important enough to consider adding to
the Gmail AI Manager PROTECTED list.

CLEANUP
Recurring or low-value messages that may be candidates for archiving,
deleting, or adding to the permanent DELETE list.

UNCERTAIN
Messages where the correct action depends on the user's preference or
where there is insufficient evidence.

For CLEANUP recommendations, distinguish between:

- ARCHIVE - remove existing messages from the inbox but keep them.
- DELETE RULE - candidate for permanent sender/domain deletion.
- REVIEW - potentially unwanted, but insufficient evidence for either.

## Inbox Observation and Thread Actions

Agentic inbox review must use the local Gmail AI Manager bridge.

Endpoint:

http://127.0.0.1:8765/rules

Use PowerShell to send JSON POST requests.

Do not access Gmail, the Apps Script Web App, API keys, or credential
files directly.


### Read Inbox

When the user asks to review, analyze, organize, clean up, or assess
their inbox, retrieve inbox threads through the bridge using:

{
  "action": "getInboxThreads",
  "options": {
    "maxResults": 25
  }
}

The bridge returns read-only thread metadata including:

- threadId
- messageCount
- from
- to
- subject
- date
- snippet
- labels

Use this information to perform the initial inbox review.

Reading inbox threads does not authorize any Gmail modification.


### Recommendation Phase

After retrieving inbox threads:

1. Analyze the returned threads.
2. Apply the ATTENTION, CLEANUP, PROTECT, and UNCERTAIN reasoning
   rules defined in this file.
3. Read the accountType and allowedLabels returned by getInboxThreads.
   Treat allowedLabels as the authoritative label taxonomy for the
   current Gmail account.
   Before presenting recommendations, verify that accountType and
   allowedLabels were returned by getInboxThreads.

   At the end of every inbox review, report:

   Account profile: <accountType>
   Available labels: <allowedLabels>

   If accountType or allowedLabels is missing from the bridge response,
   state that explicitly. Do not assume or invent the taxonomy.

   When allowedLabels is present, label recommendations are part of the
   inbox review. For each thread, explicitly decide whether one of the
   allowed labels applies. If one clearly applies, include it in the
   recommendation.
4. For every thread, consider whether one of the returned allowedLabels
   meaningfully describes the message.
5. When a label clearly fits, include that label in the recommendation.
   A label recommendation may be combined with ARCHIVE.
   A label must be supported by the sender, subject, snippet, or other
   metadata returned by the bridge.

   If the available evidence is insufficient to determine a label, do not
   guess and do not fetch additional message content merely to force a
   classification.

   Instead, recommend REVIEW or UNCERTAIN and ask the user when their
   preference is needed.

   Do not force semantically different mail into the closest available
   label. It is valid to archive a thread without applying any label.
6. Do not force a label onto every retained message. If none of the
   allowedLabels meaningfully applies, recommend no label.
7. Never recommend a label that is not present in allowedLabels.
8. Present recommendations to the user before modifying Gmail.

When a message is clearly from a recurring newsletter, receipt sender,
or other sender whose future handling appears predictable, Codex may
separately recommend an AUTO rule.

Keep the one-time recommendation and AUTO recommendation distinct.

Example:

Current message:
LABEL: Newsletters + ARCHIVE

Optional AUTO rule:
Future mail from techpresso@dupple.com -> Newsletters + Archive

Before presenting an AUTO rule for approval, explicitly state:

"This AUTO rule will apply to all existing Inbox messages from
<sender> and future messages from that sender."

Do not create the AUTO rule unless the user explicitly approves the
persistent behavior.

For messages where both labeling and archiving are appropriate, express
the recommendation explicitly as:

LABEL: <allowed label> + ARCHIVE

For messages that should receive a label but remain in the inbox:

LABEL: <allowed label> + KEEP IN INBOX

For messages that should be archived without a meaningful taxonomy
label:

ARCHIVE

Do not archive or label threads during this phase.

Do not invent thread IDs. Preserve the exact threadId returned by
getInboxThreads and associate it internally with the numbered
recommendation shown to the user.


### Approval Boundary

Thread modifications require explicit user approval.

The user may approve recommendations naturally, for example:

"Archive 2 and 4."

"Label 3 as Newsletters and archive it."

"Approve all except 1."

Resolve references such as these against the recommendations from the
current inbox review.

Execute only the actions the user approved.

Do not reinterpret an approval to include additional threads or
actions.

### AUTO Rule Approval Semantics

A one-time thread action and a persistent AUTO rule are different actions
and must never be treated as interchangeable.

THREAD ACTION:
Applies only to the specific threadId approved by the user.

AUTO RULE:
Applies to all Inbox messages matching the exact sender address,
including existing matching Inbox messages and future matching messages.

Before creating an AUTO rule, explicitly tell the user:

"This AUTO rule will apply to all existing Inbox messages from
<sender> and future messages from that sender."

Do not create an AUTO rule from approval of a one-time thread action.

For example:

"Archive this" means archive the approved thread only.

"Always archive Techpresso" or explicit approval of a proposed AUTO
rule may create a persistent AUTO rule.

If the user's intent between one-time and persistent behavior is
ambiguous, ask before executing.

### Persistent AUTO Rules

AUTO rules provide deterministic handling for known recurring senders.

An AUTO rule contains:

- sender - exact sender email address
- label - one label from allowedLabels
- archive - true or false

AUTO rules are appropriate when the user wants future mail from a known
sender handled consistently.

Examples:

"Always label Techpresso as Newsletters and archive it."

"Automatically put receipts from receipts@example.com in Receipts and
archive them."

"From now on, label messages from example@example.com as Action but
leave them in the inbox."

Do not create an AUTO rule merely because a sender appears recurring.
Codex may recommend an AUTO rule, but creation requires explicit user
approval.

Before requesting approval, explicitly state:

"This AUTO rule will apply to all existing Inbox messages from
<sender> and future messages from that sender."

When the user approves an AUTO rule, send one POST request to the
localhost bridge:

{
  "action": "applyAutoRuleChanges",
  "changes": {
    "add": [
      {
        "sender": "sender@example.com",
        "label": "Newsletters",
        "archive": true
      }
    ],
    "remove": []
  }
}

Use the exact sender email address observed in Gmail.

The label must be one of the allowedLabels returned by
getInboxThreads.

Multiple approved AUTO rule changes SHOULD be combined into one
applyAutoRuleChanges request.

AUTO rule changes must not be combined with applyThreadActions or
applyRuleChanges. They are separate transactions.

After execution, report:

- the AUTO rule created or removed
- how many existing Inbox messages matched
- how many were labeled
- how many were archived

If the user asks to stop automatic handling for a sender, remove the
AUTO rule using:

{
  "action": "applyAutoRuleChanges",
  "changes": {
    "add": [],
    "remove": [
      "sender@example.com"
    ]
  }
}

Removing an AUTO rule stops future automatic handling. It does not undo
labels or archiving already applied to existing messages.

Do not access the AUTO sheet directly. The Gmail AI Manager backend is
authoritative for AUTO rules.

### Apply Approved Thread Actions

After explicit approval, send approved label and archive operations
through the localhost bridge using:

{
  "action": "applyThreadActions",
  "actions": [
    {
      "threadId": "THREAD_ID",
      "labels": ["Newsletters"],
      "archive": true
    }
  ]
}

Each action must contain:

- threadId - exact Gmail thread ID returned by getInboxThreads
- labels - array of approved labels, or [] when no label is being added
- archive - true or false

Multiple approved thread actions SHOULD be combined into one request.

The Gmail AI Manager backend determines which labels are valid for the
configured account taxonomy.

Do not invent labels or substitute labels from another account
taxonomy.

If the backend rejects a label, report the error rather than attempting
to create, rename, or substitute a label.


### Thread Action Rules

ARCHIVE means remove the approved thread from the Inbox while retaining
it in Gmail.

LABEL means add the approved taxonomy label to the thread.

A thread may be labeled without being archived:

{
  "threadId": "THREAD_ID",
  "labels": ["Action"],
  "archive": false
}

A thread may be labeled and archived in the same operation:

{
  "threadId": "THREAD_ID",
  "labels": ["Newsletters"],
  "archive": true
}

A thread may be archived without adding a label:

{
  "threadId": "THREAD_ID",
  "labels": [],
  "archive": true
}

Do not use applyThreadActions for permanent DELETE or PROTECTED rules.
Those continue to use applyRuleChanges.


### Bridge Safety

For inbox observation and approved thread actions:

1. Communicate only with http://127.0.0.1:8765/rules.
2. Use POST only.
3. Never access the Apps Script Web App directly.
4. Never read, request, display, copy, or modify API keys or credential
   files.
5. Never modify GmailAIBridge.ps1 or Apps Script files while executing
   an ordinary inbox-management request.
6. If the bridge is unavailable, report that Gmail AI Manager is not
   running. Do not bypass the bridge.
7. Do not probe the endpoint with GET, HEAD, OPTIONS, or other
   connectivity requests.

## Safety Rules

During an inbox review:

1. Do not delete messages.
2. Do not create permanent DELETE rules.
3. Do not create PROTECTED rules.
4. Do not archive messages.
5. Do not send email.
6. Do not modify Gmail.

First present recommendations to the user.

Only perform changes after the user explicitly approves them.

When permanent DELETE or PROTECTED rules are approved, execute them
through the existing Gmail AI Manager bridge rather than implementing
separate Gmail filtering logic.

Prefer sender-level rules when only one sender is unwanted.
Recommend a domain-level rule only when there is evidence that the
entire domain should be treated the same way.

Never infer that a newsletter, promotion, automated message, or
frequent sender is unwanted solely because it is automated or frequent.

## Review Output

Keep the report concise and numbered so the user can approve actions
naturally.

Example:

ATTENTION

1. Google - Security alert
   Reason: New account sign-in detected.

2. Company - Contract awaiting signature
   Reason: Appears to require action.

CLEANUP

3. promotions@example.com
   Recommendation: DELETE RULE
   Reason: Repeated promotional messages with no apparent transactional
   content.

4. notifications@example.com
   Recommendation: ARCHIVE
   Reason: Routine notifications that may still be useful historically.

PROTECT

5. billing@example.com
   Reason: Account and billing correspondence.

UNCERTAIN

6. newsletter@example.com
   Reason: Recurring newsletter, but content appears related to the
   user's interests.

The user should be able to respond with instructions such as:

"Delete 3, archive 4, protect 5, leave everything else alone."

Resolve those numbers against the recommendations from the current
review and execute only the approved actions.