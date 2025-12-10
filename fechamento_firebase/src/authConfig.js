/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID_HERE", // This is the ONLY mandatory field that you need to supply.
        authority: "https://login.microsoftonline.com/YOUR_TENANT_ID_HERE", // Defaults to "https://login.microsoftonline.com/common"
        redirectUri: "http://localhost:3000", // You must register this URI on Azure Portal/App Registration. Defaults to window.location.origin
        postLogoutRedirectUri: "/", // Indicates the page to navigate after logout.
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            logLevel: LogLevel.Verbose,
        }
    }
};