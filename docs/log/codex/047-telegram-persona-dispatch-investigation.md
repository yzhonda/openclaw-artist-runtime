# 047 - Telegram Persona Dispatch Investigation

Task: artist-runtime-29622368-01
Date: 2026-04-28

## Scope

Read-only investigation for Plan v9.10 Phase 1c. No production code, manifest,
runtime workspace, bundled OpenClaw runtime, Telegram token path, or persona
source file was modified.

Inputs treated as facts:

- OpenClaw 2026.4.24 gateway logs show all 7 artist-runtime runtime-slash
  commands registered successfully at 20:19:57.
- The artist-runtime startup diagnostic snapshot includes `persona` in
  `getPluginCommandSpecs("telegram")`.
- The remaining observed failure is Telegram returning `Unknown command:
  /persona`.

## Section 1: Plugin Registry Sync

### Registration path

Bundled OpenClaw exposes `registerCommand` through the plugin API and writes
commands into the global plugin command registry when global side effects are
active:

- `.local/openclaw/lib/node_modules/openclaw/dist/loader-NucjcOgv.js:1292-1335`
  defines the loader-side `registerCommand(record, command)`.
- `.local/openclaw/lib/node_modules/openclaw/dist/loader-NucjcOgv.js:1315-1318`
  calls `registerPluginCommand(record.id, command, { pluginName, pluginRoot })`.
- `.local/openclaw/lib/node_modules/openclaw/dist/loader-NucjcOgv.js:1498-1499`
  exposes that function as `api.registerCommand`.

The registry implementation is global-singleton backed:

- `.local/openclaw/lib/node_modules/openclaw/dist/command-registration-lrx31fSB.js:7-16`
  stores `pluginCommands` in a global singleton and proxies reads/writes to it.
- `.local/openclaw/lib/node_modules/openclaw/dist/command-registration-lrx31fSB.js:146-179`
  validates and registers each plugin command under `/<normalized-name>`.

### Telegram menu/spec path

Telegram reads the same registry through `getPluginCommandSpecs("telegram")`:

- `.local/openclaw/lib/node_modules/openclaw/dist/command-registration-lrx31fSB.js:48-52`
  gates provider specs on `getChannelPlugin(provider)?.commands?.nativeCommandsAutoEnabled === true`.
- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/shared-OkW04SMA.js:571-573`
  declares `nativeCommandsAutoEnabled: true` for Telegram.
- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/bot-gUR32RLX.js:436-438`
  builds `pluginCatalog` from `getPluginCommandSpecs("telegram")`.
- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/bot-deps-CWMurWhK.js:83-117`
  validates plugin command names/descriptions and produces Telegram menu command
  entries.

The Phase 1a runtime log confirming `persona` in the artist-runtime
`getPluginCommandSpecs("telegram")` snapshot means the provider gate and global
registry were both visible at artist-runtime registration time.

### Telegram dispatch path

Telegram binds two groups of handlers:

- Native/core commands: `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/bot-gUR32RLX.js:545-746`
- Plugin commands: `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/bot-gUR32RLX.js:747-833`

For plugin commands specifically:

- `bot.command(pluginCommand.command, ...)` is registered for each
  `pluginCatalog.commands` entry at `bot-gUR32RLX.js:747`.
- The incoming Telegram command text is reconstructed as
  `/${pluginCommand.command}${rawText ? ... : ""}` at `bot-gUR32RLX.js:754-755`.
- Dispatch then calls `matchPluginCommand(commandBody)` at
  `bot-gUR32RLX.js:756-757`.
- If matched, it calls `executePluginCommand(...)` at
  `bot-gUR32RLX.js:820-833`.

`matchPluginCommand` also reads the same global plugin command registry:

- `.local/openclaw/lib/node_modules/openclaw/dist/commands-DeM9wUEE.js:23-40`
  normalizes the command body, looks up `pluginCommands`, supports `_` / `-`
  alternate keys, and rejects arguments only when `acceptsArgs` is false.

### Sync conclusion

I did not find a separate Telegram-only plugin command registry. The menu
snapshot and actual plugin-command dispatch both point back to the global
`pluginCommands` registry.

Therefore, if the Phase 1a log shows `persona` in
`getPluginCommandSpecs("telegram")`, the expected Telegram startup path should
also build a `pluginCatalog.commands` entry for `persona` unless one of these
later filters applies:

1. `buildPluginTelegramMenuCommands` rejects `persona` as invalid or missing a
   description.
2. `buildPluginTelegramMenuCommands` drops it due to conflict with an existing
   native/custom Telegram command.
3. Telegram bot startup is using a different runtime/process/catalog snapshot
   than the one that produced the artist-runtime diagnostic log.

`persona` is valid under Telegram's command pattern
`^[a-z0-9_]{1,32}$` (`command-config-DA0b2Fs4.js:3-8`), and the registered
artist-runtime command has a non-empty description, so (1) is unlikely.

## Section 2: device-pair vs artist-runtime Diff

### device-pair reference

Bundled `device-pair` registers `/pair` with the plugin command API:

- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/device-pair/index.js:338-348`

Relevant shape:

```js
api.registerCommand({
  name: "pair",
  description: "Generate setup codes and approve device pairing requests.",
  acceptsArgs: true,
  handler: async (ctx) => { ... }
});
```

Its manifest declares:

- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/device-pair/openclaw.plugin.json:6-10`

```json
{ "name": "pair", "kind": "runtime-slash" }
```

### artist-runtime

artist-runtime registers `/persona` and related session commands through the
same API surface, with a small wrapper:

- `src/commands/index.ts:111-120` registers `persona`.
- `src/commands/index.ts:121-135` registers `setup`, `confirm`, `cancel`,
  `skip`, `back`, and `answer`.

Relevant shape:

```ts
safeRegisterCommand(api, {
  name: "persona",
  description: "Manage artist-runtime persona setup, audit, fill, migrate, edit, and reset.",
  acceptsArgs: true,
  requireAuth: true,
  nativeProgressMessages: { telegram: "Checking artist persona..." },
  handler: ...
}, logRegistration);
```

Its manifest declares the same `runtime-slash` alias kind:

- `openclaw.plugin.json:9-16`

```json
{ "name": "persona", "kind": "runtime-slash" }
```

### Diff conclusion

No material registration-surface mismatch was found:

- Both use `api.registerCommand`.
- Both use `acceptsArgs: true`.
- Both expose manifest `commandAliases` with `kind: "runtime-slash"`.
- artist-runtime additionally sets `requireAuth: true` and a Telegram progress
  message. Those affect authorization/progress after dispatch, not whether the
  command is registered or matched.
- artist-runtime wraps the API call in `safeRegisterCommand`, but Phase 1a logs
  confirm successful registration for all 7 commands, so the wrapper did not
  silently skip registration in the observed 2026.4.24 run.

`commandAliases` appears to support discovery/activation/help surfaces, not the
runtime dispatch registry itself. Dispatch depends on the command registered via
`api.registerCommand`.

## Section 3: `Unknown command` Dispatch Code Path

### Telegram plugin miss text

In the Telegram plugin command path, a plugin command handler miss does not emit
`Unknown command: /persona`. It emits `Command not found.`:

- `.local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-f02f65236126/dist/extensions/telegram/bot-gUR32RLX.js:754-764`

That branch is only reached after `bot.command(pluginCommand.command, ...)`
fires for a plugin catalog entry, but `matchPluginCommand(commandBody)` returns
null.

### Generic plugin command miss

The generic auto-reply plugin command handler also does not emit
`Unknown command`. It returns null and lets later handlers continue:

- `.local/openclaw/lib/node_modules/openclaw/dist/commands-handlers.runtime-sqvDwVFw.js:3189-3195`

```js
const match = matchPluginCommand(command.commandBodyNormalized);
if (!match) return null;
```

### Literal `Unknown command` search

A read-only search for the literal `Unknown command` in the installed OpenClaw
runtime found no Telegram plugin dispatch branch with that exact response.
Relevant hits were:

- static/control UI command handling code containing a fallback like
  `Unknown command: \`/${n}\``;
- unrelated lobster/register/audit code paths;
- no `extensions/telegram/...` plugin-command miss branch returning that text.

This means the observed `Unknown command: /persona` is unlikely to be the
Telegram plugin-command miss branch at `bot-gUR32RLX.js:758-764`. The observed
message is still factual; the most likely interpretation from source is that
the update did not reach the plugin-command `bot.command("persona", ...)`
handler and instead fell into a generic slash-command path, or that another
runtime bundle/process produced the response.

### Conditions where `/persona` can fail to match

From the inspected code, `/persona` can miss in these ways:

1. **No `bot.command("persona")` handler was bound at Telegram startup.**
   This would happen if `pluginCatalog.commands` lacked `persona`, even though
   the artist-runtime registration log saw it earlier. The next evidence to
   collect is a Telegram startup-side log of `pluginCatalog.commands`, not only
   artist-runtime's own `getPluginCommandSpecs` snapshot.

2. **`pluginCatalog` dropped `persona` due to conflict with an existing native
   or custom command.** `buildPluginTelegramMenuCommands` rejects commands in
   `existingCommands` at `bot-deps-CWMurWhK.js:101-104`. A custom Telegram
   command named `persona` would cause this. No source fix should be made until
   config/log evidence confirms or rejects this.

3. **The handler was bound, but the global registry changed before execution.**
   In that case `bot.command("persona")` fires, but `matchPluginCommand` returns
   null and Telegram replies `Command not found.`. This does not match the
   observed text exactly, but it is a real code path.

4. **Telegram native command support is disabled in the runtime config.**
   If native support is disabled before Telegram startup, plugin commands may
   not be exposed. This is partially contradicted by Phase 1a's
   `getPluginCommandSpecs("telegram")` containing `persona`, because
   `getPluginCommandSpecs` is provider-gated on Telegram's native command
   support.

5. **Different runtime/process/bundle.** The gateway may log artist-runtime
   registration from one bundle/process while Telegram polling/dispatch is
   occurring in another stale process. This would explain why artist-runtime
   sees `persona` but Telegram does not.

6. **Bot command syntax is not parsed as a Telegram bot command.** For example,
   group command addressing or message shape issues could route the message
   through normal text handling. This would need live update logs to prove; it
   is not visible from static source alone.

## Section 4: Hypotheses and Next Verification Steps

### Working conclusion

The source-level registration strategy still looks structurally correct:

- `registerCommand` exists and writes to the global plugin command registry.
- `runtime-slash` is the same alias kind used by `device-pair`.
- Telegram's plugin command menu and dispatch both read the global plugin
  command registry.
- `device-pair` and artist-runtime differ only in wrapper/progress/auth details,
  not in the dispatch-critical API shape.

The new clue is the exact response text. Telegram's plugin-command miss branch
returns `Command not found.`, not `Unknown command: /persona`. So the observed
`Unknown command: /persona` points away from the plugin-command handler and
toward a generic slash-command path, stale/different process, or command not
being bound in Telegram at startup.

### Next verification steps (no fix yet)

1. **Collect Telegram-side plugin catalog at startup.**
   Add or enable a diagnostic at Telegram provider startup showing
   `pluginCatalog.commands` and whether it contains `persona`. Artist-runtime's
   own snapshot proves global registry visibility at plugin registration time,
   but not that Telegram actually bound `bot.command("persona")`.

2. **Check custom command conflicts.**
   Inspect runtime config for `channels.telegram.commands.customCommands` (or
   equivalent resolved account config) containing `persona`, `setup`, `confirm`,
   `cancel`, `skip`, `back`, or `answer`. A conflict would be logged through
   `pluginCatalog.issues` and would drop the plugin command before binding.

3. **Check live log for the exact miss branch.**
   If Telegram returns `Command not found.`, the handler was bound but
   `matchPluginCommand` missed. If it returns `Unknown command: /persona`, the
   plugin command handler likely did not run.

4. **Confirm process/bundle identity.**
   Confirm the gateway process that emits artist-runtime registration logs is
   the same process that owns Telegram polling. The strongest evidence would be
   a single startup window containing:
   - artist-runtime registered all 7 commands;
   - Telegram plugin catalog contains `persona`;
   - Telegram bound plugin command handlers for those names.

5. **Do not patch artist-runtime command registration yet.**
   Based on static source, there is no evidence that artist-runtime's
   `api.registerCommand` call shape is wrong. The next narrow fix, if any, is
   likely additional Telegram-side diagnostics or config conflict handling, not
   another artist-runtime registration rewrite.

## Commands Run

- `ls -d .local/openclaw/state/plugin-runtime-deps/openclaw-2026.4.24-*/dist`
- `rg -n "registerCommand|getPluginCommandSpecs|runtime-slash|commandAliases|processCommand|onMessage|slash" ...`
- `nl -ba .../extensions/telegram/bot-gUR32RLX.js | sed -n ...`
- `nl -ba .../command-registration-lrx31fSB.js | sed -n ...`
- `nl -ba .../commands-DeM9wUEE.js | sed -n ...`
- `nl -ba .../loader-NucjcOgv.js | sed -n ...`
- `nl -ba .../extensions/device-pair/index.js | sed -n ...`
- `cat .../extensions/device-pair/openclaw.plugin.json`
- `sed -n '1,40p' openclaw.plugin.json`

