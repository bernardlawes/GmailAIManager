/***************************************************************
 * GMAIL CLEANUP MANAGER - WEB API
 *
 * External interface for Goal #2.
 *
 * POST requests may invoke applyRuleChanges().
 ***************************************************************/


function doPost(e) {

  try {

    /***********************************************************
     * 1. VERIFY REQUEST BODY
     ***********************************************************/

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      return jsonResponse({
        success: false,
        error: 'Missing request body.'
      });
    }


    const request =
      JSON.parse(e.postData.contents);


    /***********************************************************
     * 2. AUTHENTICATE
     ***********************************************************/

    const expectedKey =
      PropertiesService
        .getScriptProperties()
        .getProperty('GMAIL_CLEANUP_API_KEY');


    if (!expectedKey) {
      throw new Error(
        'Server API key has not been configured.'
      );
    }


    if (
      !request.apiKey ||
      request.apiKey !== expectedKey
    ) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized.'
      });
    }


    /***********************************************************
     * 3. ONLY ALLOW OUR CONTROLLED OPERATION
     ***********************************************************/

    if (request.action === 'applyRuleChanges') {

      return jsonResponse(
        applyRuleChanges(
          request.changes || {}
        )
      );

    }

    if (request.action === 'applyThreadActions') {

      return jsonResponse(
        applyThreadActions(
          request.actions || []
        )
      );

    }

    if (request.action === 'applyAutoRuleChanges') {
      return jsonResponse(
        applyAutoRuleChanges(
          request.changes || {}
        )
      );
    }

    if (request.action === 'getInboxThreads') {

      return jsonResponse(
        getInboxThreads(
          request.options || {}
        )
      );

    }

    return jsonResponse({
      success: false,
      error: 'Unsupported action.'
    });


    /***********************************************************
     * 4. EXECUTE THROUGH RULE API
     ***********************************************************/

    const result =
      applyRuleChanges(
        request.changes || {}
      );


    /***********************************************************
     * 5. RETURN RESULT
     ***********************************************************/

    return jsonResponse(result);


  } catch (error) {

    console.error(error);

    return jsonResponse({
      success: false,
      error: String(
        error.message || error
      )
    });

  }

}


/***************************************************************
 * JSON RESPONSE
 ***************************************************************/

function jsonResponse(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}


function generateApiKey() {

  const key =
    Utilities.getUuid() +
    Utilities.getUuid();

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'GMAIL_CLEANUP_API_KEY',
      key
    );

  console.log(
    'API key created and stored in Script Properties.'
  );

  return key;

}

function generateEmailUpdatesWebSecret() {

  const secret =
    Utilities.getUuid() +
    Utilities.getUuid();

  PropertiesService
    .getScriptProperties()
    .setProperty(
      EMAIL_UPDATES_WEB_SECRET_KEY,
      secret
    );

  console.log(
    'Email Updates recovery secret created and stored in Script Properties.'
  );

  return secret;

}

function testThreadActionRoute() {

  const result =
    applyThreadActions([]);

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

}