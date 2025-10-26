import { httpRouter } from "convex/server";

const http = httpRouter();

// Authentication is now handled by Clerk via the middleware
// No need for Convex Auth HTTP routes

export default http;
