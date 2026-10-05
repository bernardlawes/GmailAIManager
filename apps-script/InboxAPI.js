/***************************************************************
 * GMAIL AI MANAGER - INBOX OBSERVATION API
 *
 * READ ONLY.
 *
 * Provides thread metadata for AI review.
 * Does not modify Gmail.
 ***************************************************************/


/***************************************************************
 * GET INBOX THREADS
 *
 * options:
 *   maxResults - number of threads, default 25, maximum 100
 *   query      - optional Gmail search query
 ***************************************************************/

function getInboxThreads(options) {

  options = options || {};

  // Build Gmail label ID -> label name lookup.
  const labelResponse =
    Gmail.Users.Labels.list('me');

  const labelNamesById = {};

  for (
    const label of
    (labelResponse.labels || [])
  ) {

    labelNamesById[label.id] =
      label.name;

  }

  let maxResults =
    Number(options.maxResults || 25);

  if (
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > 100
  ) {
    throw new Error(
      'maxResults must be an integer from 1 to 100.'
    );
  }


  let query = 'in:inbox';

  if (
    typeof options.query === 'string' &&
    options.query.trim()
  ) {
    query +=
      ' ' +
      options.query.trim();
  }


  const results =
    Gmail.Users.Threads.list(
      'me',
      {
        q: query,
        maxResults: maxResults
      }
    );


  const threads = [];


  for (
    const threadSummary of
    (results.threads || [])
  ) {

    const thread =
      Gmail.Users.Threads.get(
        'me',
        threadSummary.id,
        {
          format: 'metadata',
          metadataHeaders: [
            'From',
            'To',
            'Date',
            'Subject'
          ]
        }
      );


    const messages =
      thread.messages || [];

    if (!messages.length) {
      continue;
    }


    const newestMessage =
      messages[messages.length - 1];

    const headers = {};


    for (
      const header of
      (newestMessage.payload.headers || [])
    ) {

      headers[
        header.name.toLowerCase()
      ] = header.value;

    }


    const labelIds =
      newestMessage.labelIds || [];

    const labels =
      labelIds.map(
        labelId =>
          labelNamesById[labelId] ||
          labelId
      );

    threads.push({

      threadId:
        thread.id,

      messageCount:
        messages.length,

      from:
        headers.from || '',

      to:
        headers.to || '',

      subject:
        headers.subject || '',

      date:
        headers.date || '',

      snippet:
        newestMessage.snippet || '',

      labels:
        labels

    });

  }


  return {
    success: true,
    apiVersion: '1.0',
    accountType: getGmailAIAccountType(),
    allowedLabels: getAllowedGmailAILabels(),
    query: query,
    requested: maxResults,
    returned: threads.length,
    threads: threads
  };

}


/***************************************************************
 * READ-ONLY TEST
 ***************************************************************/

function testGetInboxThreads() {

  const result =
    getInboxThreads({
      maxResults: 5
    });


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}