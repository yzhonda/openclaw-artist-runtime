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
  method: "GET" | "POST";
  path: string;
  handler: UnknownHandler;
}

export interface PluginApiLike {
  registerTool?: (tool: ToolRegistration) => void;
  registerHook?: (hook: HookRegistration) => void;
  registerService?: (service: ServiceRegistration) => void;
  registerHttpRoute?: (route: RouteRegistration) => void;
}

function asPluginApi(api: unknown): PluginApiLike {
  return typeof api === "object" && api !== null ? (api as PluginApiLike) : {};
}

export function safeRegisterTool(api: unknown, tool: ToolRegistration): void {
  asPluginApi(api).registerTool?.(tool);
}

export function safeRegisterHook(api: unknown, hook: HookRegistration): void {
  asPluginApi(api).registerHook?.(hook);
}

export function safeRegisterService(api: unknown, service: ServiceRegistration): void {
  asPluginApi(api).registerService?.(service);
}

export function safeRegisterRoute(api: unknown, route: RouteRegistration): void {
  asPluginApi(api).registerHttpRoute?.(route);
}
