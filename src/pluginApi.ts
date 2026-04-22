type UnknownHandler = (payload?: unknown) => unknown | Promise<unknown>;

export interface ToolRegistration {
  name: string;
  handler: UnknownHandler;
}

export interface HookRegistration {
  event: string;
  handler: UnknownHandler;
}

export interface ServiceRegistration {
  name: string;
  create: () => unknown;
}

export interface RouteRegistration {
  method: "GET" | "POST" | "PATCH";
  path: string;
  handler: UnknownHandler;
  auth?: "plugin" | "gateway";
  match?: "exact" | "prefix";
}

export interface PluginApiLike {
  registerTool?: (tool: ToolRegistration, opts?: { name?: string; names?: string[]; optional?: boolean }) => void;
  registerHook?: (events: string | string[], handler: UnknownHandler, opts?: { name?: string; description?: string; register?: boolean }) => void;
  registerService?: (service: { id?: string; name?: string; start?: UnknownHandler; stop?: UnknownHandler }) => void;
  registerHttpRoute?: (route: {
    path: string;
    handler: UnknownHandler;
    auth?: "plugin" | "gateway";
    match?: "exact" | "prefix";
  }) => void;
}

function asPluginApi(api: unknown): PluginApiLike {
  return typeof api === "object" && api !== null ? (api as PluginApiLike) : {};
}

export function safeRegisterTool(api: unknown, tool: ToolRegistration): void {
  asPluginApi(api).registerTool?.(tool, { name: tool.name });
}

export function safeRegisterHook(api: unknown, hook: HookRegistration): void {
  const registerHook = asPluginApi(api).registerHook;
  if (!registerHook) {
    return;
  }
  registerHook(hook.event, hook.handler, { name: hook.event });
}

export function safeRegisterService(api: unknown, service: ServiceRegistration): void {
  asPluginApi(api).registerService?.({
    id: service.name,
    start: async () => {
      const instance = service.create();
      if (typeof instance === "object" && instance !== null && "start" in instance && typeof (instance as { start?: UnknownHandler }).start === "function") {
        return (instance as { start: UnknownHandler }).start();
      }
      return instance;
    },
    stop: async () => {
      const instance = service.create();
      if (typeof instance === "object" && instance !== null && "stop" in instance && typeof (instance as { stop?: UnknownHandler }).stop === "function") {
        return (instance as { stop: UnknownHandler }).stop();
      }
      return undefined;
    }
  });
}

export function safeRegisterRoute(api: unknown, route: RouteRegistration): void {
  asPluginApi(api).registerHttpRoute?.({
    path: route.path,
    handler: route.handler,
    auth: route.auth ?? "plugin",
    match: route.match
  });
}
