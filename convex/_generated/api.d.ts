/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adapters_base from "../adapters/base.js";
import type * as adapters_buysportscards from "../adapters/buysportscards.js";
import type * as adapters_ebay from "../adapters/ebay.js";
import type * as adapters_index from "../adapters/index.js";
import type * as adapters_mycardpost from "../adapters/mycardpost.js";
import type * as adapters_myslabs from "../adapters/myslabs.js";
import type * as adapters_secret_manager from "../adapters/secret_manager.js";
import type * as adapters_sportlots from "../adapters/sportlots.js";
import type * as adapters_testBscSetParameters from "../adapters/testBscSetParameters.js";
import type * as adapters_types from "../adapters/types.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as myFunctions from "../myFunctions.js";
import type * as userProfile from "../userProfile.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "adapters/base": typeof adapters_base;
  "adapters/buysportscards": typeof adapters_buysportscards;
  "adapters/ebay": typeof adapters_ebay;
  "adapters/index": typeof adapters_index;
  "adapters/mycardpost": typeof adapters_mycardpost;
  "adapters/myslabs": typeof adapters_myslabs;
  "adapters/secret_manager": typeof adapters_secret_manager;
  "adapters/sportlots": typeof adapters_sportlots;
  "adapters/testBscSetParameters": typeof adapters_testBscSetParameters;
  "adapters/types": typeof adapters_types;
  auth: typeof auth;
  http: typeof http;
  myFunctions: typeof myFunctions;
  userProfile: typeof userProfile;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
