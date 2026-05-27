import { httpRouter } from "convex/server";
import { resetUserStateHttp } from "./testing";

const http = httpRouter();

http.route({
  path: "/testing/reset-user-state",
  method: "POST",
  handler: resetUserStateHttp,
});

export default http;
