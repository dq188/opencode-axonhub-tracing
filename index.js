// AxonHub trace headers for OpenCode 2 (local port of opencode-axonhub-tracing@1.1.0).
//
// The V1 package registered `chat.headers` and set:
//   AH-Thread-Id = session id
//   AH-Trace-Id  = current message id (only when one was available)
//
// V2 has no `chat.headers` hook. The closest hook is `model.request`, which
// exposes sessionID, agent, model, kind and a mutable `headers` record -- but
// no message id. Message ids are exposed on the `prompt` hook (admission), so
// the admitted message id is remembered per session here and replayed for that
// session's model requests. As in V1, the trace header is written only when a
// message id is known.
//
// Header names can be overridden with the same env vars as V1:
//   OPENCODE_AXONHUB_TRACING_THREAD_HEADER
//   OPENCODE_AXONHUB_TRACING_TRACE_HEADER

const DEFAULT_THREAD_HEADER = "AH-Thread-Id";
const DEFAULT_TRACE_HEADER = "AH-Trace-Id";

function resolveHeaderKey(envValue, fallback) {
  const value = typeof envValue === "string" ? envValue.trim() : "";
  return value ? value : fallback;
}

export default {
  id: "opencode-axonhub-tracing",
  async setup(ctx) {
    const threadHeader = resolveHeaderKey(
      process.env.OPENCODE_AXONHUB_TRACING_THREAD_HEADER,
      DEFAULT_THREAD_HEADER,
    );
    const traceHeader = resolveHeaderKey(
      process.env.OPENCODE_AXONHUB_TRACING_TRACE_HEADER,
      DEFAULT_TRACE_HEADER,
    );

    // sessionID -> id of the message admitted most recently for that session.
    const latestMessage = new Map();
    const remember = (sessionID, messageID) => {
      if (typeof sessionID !== "string" || sessionID.length === 0) return;
      if (typeof messageID !== "string" || messageID.length === 0) return;
      latestMessage.delete(sessionID);
      latestMessage.set(sessionID, messageID);
      // Keep the map bounded in a long-lived server: drop the oldest entries.
      while (latestMessage.size > 1000) {
        const oldest = latestMessage.keys().next();
        if (oldest.done) break;
        latestMessage.delete(oldest.value);
      }
    };

    // The prompt hook runs before admission; a throw here would block the
    // prompt, so this callback only records and never rejects.
    await ctx.session.hook("prompt", (event) => {
      remember(event?.sessionID, event?.messageID);
    });

    await ctx.session.hook(
      "model.request",
      (event) => {
        const headers = event?.headers;
        const sessionID = typeof event?.sessionID === "string" ? event.sessionID : "";
        if (!headers || !sessionID) return;
        headers[threadHeader] = sessionID;
        const traceID = latestMessage.get(sessionID);
        if (traceID) headers[traceHeader] = traceID;
      },
      { providerID: "axonhub" },
    );
  },
};
