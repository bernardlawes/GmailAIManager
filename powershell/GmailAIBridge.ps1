$ErrorActionPreference = "Stop"

$Port      = 8765
$ConfigDir = Join-Path $env:LOCALAPPDATA "GmailAIManager"
$KeyFile   = Join-Path $ConfigDir "apikey.txt"
$UrlFile   = Join-Path $ConfigDir "webapp.txt"

if (-not (Test-Path $KeyFile)) {
    throw "API key file not found."
}

if (-not (Test-Path $UrlFile)) {
    throw "Web App URL file not found."
}

# Load credentials once at startup.
$secureKey  = Get-Content $KeyFile | ConvertTo-SecureString
$credential = [PSCredential]::new("unused", $secureKey)
$apiKey     = $credential.GetNetworkCredential().Password
$webAppUrl  = (Get-Content $UrlFile -Raw).Trim()

# Listen only on localhost.
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host ""
Write-Host "Gmail AI Manager bridge is running."
Write-Host "Listening only on http://127.0.0.1:$Port/"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {

    while ($listener.IsListening) {

        $context  = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        try {

            # POST only.
            if ($request.HttpMethod -ne "POST") {
                throw "Only POST is permitted."
            }

            # Only this endpoint exists.
            if ($request.Url.AbsolutePath -ne "/rules") {
                throw "Unknown endpoint."
            }

            $reader = [IO.StreamReader]::new($request.InputStream)
            $raw    = $reader.ReadToEnd()
            $reader.Close()

            $inputData = $raw | ConvertFrom-Json

            if ([string]::IsNullOrWhiteSpace([string]$inputData.action)) {
                throw "An action is required."
            }


            # ==================================================
            # RULE CHANGES
            # ==================================================

            if ($inputData.action -eq "applyRuleChanges") {

                if ($null -eq $inputData.changes) {
                    throw "A changes object is required."
                }

                $allowedFields = @(
                    "addDelete",
                    "removeDelete",
                    "addProtected",
                    "removeProtected"
                )

                # Reject unknown rule operations.
                foreach ($property in $inputData.changes.PSObject.Properties.Name) {
                    if ($property -notin $allowedFields) {
                        throw "Invalid changes field: $property"
                    }
                }

                $changes = @{
                    addDelete       = @()
                    removeDelete    = @()
                    addProtected    = @()
                    removeProtected = @()
                }

                $totalValues = 0

                foreach ($field in $allowedFields) {

                    $property =
                        $inputData.changes.PSObject.Properties[$field]

                    if ($null -ne $property) {

                        $values = @($property.Value)

                        foreach ($value in $values) {

                            if ($null -eq $value) {
                                throw "Null value supplied for $field."
                            }

                            $text = [string]$value

                            if ([string]::IsNullOrWhiteSpace($text)) {
                                throw "Empty value supplied for $field."
                            }
                        }

                        $changes[$field] = $values
                        $totalValues += $values.Count
                    }
                }

                if ($totalValues -eq 0) {
                    throw "At least one rule change is required."
                }

                if ($totalValues -gt 100) {
                    throw "Maximum 100 rule changes per request."
                }

                $body = @{
                    apiKey  = $apiKey
                    action  = "applyRuleChanges"
                    changes = $changes
                } | ConvertTo-Json -Depth 10
            }


            # ==================================================
            # THREAD ACTIONS
            # ==================================================

            elseif ($inputData.action -eq "applyThreadActions") {

                if ($null -eq $inputData.actions) {
                    throw "An actions array is required."
                }

                $actions = @($inputData.actions)

                if ($actions.Count -gt 100) {
                    throw "Maximum 100 thread actions per request."
                }

                foreach ($threadAction in $actions) {

                    if ($null -eq $threadAction) {
                        throw "Null thread action supplied."
                    }

                    $allowedActionFields = @(
                        "threadId",
                        "labels",
                        "archive"
                    )

                    # Reject unknown thread-action fields.
                    foreach (
                        $property in
                        $threadAction.PSObject.Properties.Name
                    ) {
                        if ($property -notin $allowedActionFields) {
                            throw "Invalid thread action field: $property"
                        }
                    }

                    if (
                        [string]::IsNullOrWhiteSpace(
                            [string]$threadAction.threadId
                        )
                    ) {
                        throw "Each thread action requires a threadId."
                    }

                    if ($null -eq $threadAction.archive) {
                        throw "Each thread action requires archive."
                    }

                    if (
                        $threadAction.archive -isnot [bool]
                    ) {
                        throw "archive must be boolean."
                    }

                    if ($null -eq $threadAction.labels) {
                        throw "Each thread action requires a labels array."
                    }

                    foreach ($label in @($threadAction.labels)) {

                        if ($null -eq $label) {
                            throw "Null label supplied."
                        }

                        if (
                            [string]::IsNullOrWhiteSpace(
                                [string]$label
                            )
                        ) {
                            throw "Empty label supplied."
                        }
                    }
                }

                $body = @{
                    apiKey  = $apiKey
                    action  = "applyThreadActions"
                    actions = $actions
                } | ConvertTo-Json -Depth 10
            }


            # ==================================================
            # READ-ONLY INBOX OBSERVATION
            # ==================================================

            elseif ($inputData.action -eq "getInboxThreads") {

                $maxResults = 25
                $query = ""

                if ($null -ne $inputData.options) {

                    $allowedOptionFields = @(
                        "maxResults",
                        "query"
                    )

                    foreach (
                        $property in
                        $inputData.options.PSObject.Properties.Name
                    ) {
                        if ($property -notin $allowedOptionFields) {
                            throw "Invalid inbox option: $property"
                        }
                    }

                    if ($null -ne $inputData.options.maxResults) {

                        $maxResults =
                            [int]$inputData.options.maxResults

                        if (
                            $maxResults -lt 1 -or
                            $maxResults -gt 100
                        ) {
                            throw "maxResults must be from 1 to 100."
                        }
                    }

                    if ($null -ne $inputData.options.query) {
                        $query =
                            [string]$inputData.options.query
                    }
                }

                $body = @{
                    apiKey = $apiKey
                    action = "getInboxThreads"
                    options = @{
                        maxResults = $maxResults
                        query      = $query
                    }
                } | ConvertTo-Json -Depth 10
            }

            # ==================================================
            # AUTO RULE PREVIEW
            # ==================================================

            elseif ($inputData.action -eq "previewAutoRule") {

                if ($null -eq $inputData.rule) {
                    throw "Missing AUTO preview rule."
                }

                $allowedRuleFields = @(
                    "sender",
                    "label",
                    "archive"
                )

                foreach (
                    $property in
                    $inputData.rule.PSObject.Properties.Name
                ) {
                    if ($property -notin $allowedRuleFields) {
                        throw "Invalid AUTO preview field: $property"
                    }
                }

                if (
                    $null -eq $inputData.rule.sender -or
                    [string]::IsNullOrWhiteSpace(
                        [string]$inputData.rule.sender
                    )
                ) {
                    throw "AUTO sender is required."
                }

                if (
                    $null -eq $inputData.rule.label -or
                    [string]::IsNullOrWhiteSpace(
                        [string]$inputData.rule.label
                    )
                ) {
                    throw "AUTO label is required."
                }

                if ($null -eq $inputData.rule.archive) {
                    throw "AUTO archive is required."
                }

                if ($inputData.rule.archive -isnot [bool]) {
                    throw "AUTO archive must be true or false."
                }

                $body = @{
                    apiKey = $apiKey
                    action = "previewAutoRule"
                    rule   = @{
                        sender  = [string]$inputData.rule.sender
                        label   = [string]$inputData.rule.label
                        archive = [bool]$inputData.rule.archive
                    }
                } | ConvertTo-Json -Depth 10
            }


                # ==================================================
                # AUTO RULE MANAGEMENT
                # ==================================================

                elseif ($inputData.action -eq "applyAutoRuleChanges") {

                if ($null -eq $inputData.changes) {
                    throw "Missing AUTO changes object."
                }

                $allowedChangeFields = @(
                    "add",
                    "remove"
                )

                foreach (
                    $property in
                    $inputData.changes.PSObject.Properties.Name
                ) {
                    if ($property -notin $allowedChangeFields) {
                        throw "Invalid AUTO change field: $property"
                    }
                }

                $add = @(
                    $inputData.changes.add
                )

                $remove = @(
                    $inputData.changes.remove
                )

                if (($add.Count + $remove.Count) -gt 100) {
                    throw "Too many AUTO rule changes."
                }

                foreach ($rule in $add) {

                    if ($null -eq $rule) {
                        throw "AUTO add rule cannot be null."
                    }

                    $allowedRuleFields = @(
                        "sender",
                        "label",
                        "archive"
                    )

                    foreach (
                        $property in
                        $rule.PSObject.Properties.Name
                    ) {
                        if ($property -notin $allowedRuleFields) {
                            throw "Invalid AUTO rule field: $property"
                        }
                    }

                    if (
                        $null -eq $rule.sender -or
                        [string]::IsNullOrWhiteSpace(
                            [string]$rule.sender
                        )
                    ) {
                        throw "AUTO sender is required."
                    }

                    if (
                        $null -eq $rule.label -or
                        [string]::IsNullOrWhiteSpace(
                            [string]$rule.label
                        )
                    ) {
                        throw "AUTO label is required."
                    }

                    if ($null -eq $rule.archive) {
                        throw "AUTO archive is required."
                    }

                    if ($rule.archive -isnot [bool]) {
                        throw "AUTO archive must be true or false."
                    }
                }

                foreach ($sender in $remove) {

                    if (
                        $null -eq $sender -or
                        [string]::IsNullOrWhiteSpace(
                            [string]$sender
                        )
                    ) {
                        throw "AUTO remove sender cannot be empty."
                    }
                }

                $body = @{
                    apiKey = $apiKey
                    action = "applyAutoRuleChanges"
                    changes = @{
                        add    = $add
                        remove = $remove
                    }
                } | ConvertTo-Json -Depth 10
            }


            # ==================================================
            # REJECT EVERYTHING ELSE
            # ==================================================

            else {
                throw "Unsupported action."
            }


            # Forward exactly one validated transaction.
            $result = Invoke-RestMethod `
                -Uri $webAppUrl `
                -Method Post `
                -ContentType "application/json" `
                -Body $body

            $output = $result | ConvertTo-Json -Depth 10
            $status = 200
        }
        catch {

            $output = @{
                success = $false
                error   = $_.Exception.Message
            } | ConvertTo-Json

            $status = 400
        }

        $bytes = [Text.Encoding]::UTF8.GetBytes($output)

        $response.StatusCode      = $status
        $response.ContentType     = "application/json"
        $response.ContentEncoding = [Text.Encoding]::UTF8
        $response.ContentLength64 = $bytes.Length

        $response.OutputStream.Write(
            $bytes,
            0,
            $bytes.Length
        )

        $response.OutputStream.Close()
    }
}
finally {

    $listener.Stop()
    $listener.Close()

    $apiKey = $null

    Write-Host "Gmail AI Manager bridge stopped."
}