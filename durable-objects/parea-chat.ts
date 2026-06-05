type ChatState = {
  adventureTitle?: string;
  members: number;
  started: boolean;
};

type ChatBody = {
  message?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const defaultState = (): ChatState => ({
  members: 0,
  started: false,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });

const normalizeMessage = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() : undefined;

const handleMessage = (message: string, state: ChatState) => {
  const normalized = message.toLowerCase();
  const nextState = { ...state };

  if (normalized.length === 0) {
    return {
      replies: ["Type a message like 'I am in' or 'we want something mellow'."],
      state: nextState,
    };
  }

  if (/\b(help|commands?|what can i say)\b/u.test(normalized)) {
    return {
      replies: [
        "Try: I am in, we want something mellow, we moved to Chinatown, or where are we?",
      ],
      state: nextState,
    };
  }

  if (/\b(reset|start over|new session)\b/u.test(normalized)) {
    return {
      replies: ["Session reset. Try 'I am in'."],
      state: defaultState(),
    };
  }

  if (
    /\b(join|i am in|i'm in|add me|count me in|invite me)\b/u.test(normalized)
  ) {
    nextState.members = Math.max(1, nextState.members + 1);

    return {
      replies: [`Joined this Wander. Members: ${nextState.members}.`],
      state: nextState,
    };
  }

  if (
    /\b(mellow|foodie|cultural|active)\b/u.test(normalized) ||
    /\b(start|begin|wander|let's go|lets go)\b/u.test(normalized)
  ) {
    nextState.members = Math.max(1, nextState.members);
    nextState.started = true;
    nextState.adventureTitle = "Presidio Stroll";

    return {
      replies: [
        [
          "Your Wander is ready: Presidio Stroll.",
          "Start near Little Marina Green, pick up coffee nearby, then end at Presidio Tunnel Tops.",
          "Map: https://www.google.com/maps/search/?api=1&query=Presidio%20Tunnel%20Tops%20San%20Francisco",
        ].join("\n"),
      ],
      state: nextState,
    };
  }

  if (/\b(chinatown|outside|moved|left)\b/u.test(normalized)) {
    if (!nextState.started) {
      return {
        replies: ["Start a Wander first with 'we want something mellow'."],
        state: nextState,
      };
    }

    nextState.adventureTitle = "Chinatown Snack Quest";

    return {
      replies: [
        [
          "Reroute: Chinatown Snack Quest.",
          "The group left the Presidio zone, so Parea revised the belief and generated a new foodie route.",
          "Try Empress of China, The Baked Bear, then Caffe Trieste.",
          "Map: https://www.google.com/maps/search/?api=1&query=Chinatown%20San%20Francisco",
        ].join("\n"),
      ],
      state: nextState,
    };
  }

  if (
    /\b(status|where are we|what is active|what's active)\b/u.test(normalized)
  ) {
    if (!nextState.started) {
      return {
        replies: ["No Wander is active. Try 'we want something mellow'."],
        state: nextState,
      };
    }

    return {
      replies: [
        `Active Wander: ${nextState.adventureTitle ?? "Presidio Stroll"}. Members: ${nextState.members}.`,
      ],
      state: nextState,
    };
  }

  return {
    replies: [
      "I did not catch that. Try: I am in, we want something mellow, we moved to Chinatown, or where are we?",
    ],
    state: nextState,
  };
};

export class PareaChat {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Use POST." }, 405);
    }

    let body: ChatBody;

    try {
      body = (await req.json()) as ChatBody;
    } catch {
      return jsonResponse({ error: "Request body must be JSON." }, 400);
    }

    const message = normalizeMessage(body.message);

    if (message === undefined) {
      return jsonResponse({ error: "message must be a string." }, 400);
    }

    const existingState =
      (await this.state.storage.get<ChatState>("chatState")) ?? defaultState();
    const result = handleMessage(message, existingState);

    await this.state.storage.put("chatState", result.state);

    return jsonResponse(result);
  }
}
