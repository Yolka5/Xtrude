# Onshape webhook scope — can discovery be free?

**Short answer: no, not for this account.** There is no documented USER-scoped webhook that fires when a free/EDU person creates or first edits a new document. Company-scoped document webhooks exist, but they require a `companyId` and a company admin. They are not a replacement for polling on a personal EDU/free login. Do not implement company-scope here.

Onshape API calls made for this research: **0** (docs only).

---

## What I checked

1. Official API guide: [Webhooks](https://onshape-public.github.io/docs/app-dev/webhook/)
2. Official OpenAPI for `BTWebhookParams` / `createWebhook` (Glassworks export mirrored at [onshape-webhook-api-openapi.yml](https://raw.githubusercontent.com/api-evangelist/onshape/refs/heads/main/openapi/onshape-webhook-api-openapi.yml))
3. Onshape Help: [Company/Classroom/Enterprise Settings — Webhooks](https://cad.onshape.com/help/Content/Plans/enterprise_settings_webhooks.htm)
4. `GET /api/v6/webhooks?user={uid}` on the same guide — this **lists** webhooks a user registered; it does not subscribe to “all of this user’s future documents.”

I did not guess from forum posts when they conflicted with the official Event Groups table.

---

## Event groups (official)

Quoted from the guide:

> Event types are categorized into several different groups based on the dominant user resource of the event. The group that a given event is part of defines the required parameters needed in the registration process to identify the resource or group of resources to watch. For instance, if registering for an event in the `document` event group, the application must identify either a specific document’s id or a specific company’s id. If registered for a company, the event will be registered for all present and future documents owned by the company.

Source: https://onshape-public.github.io/docs/app-dev/webhook/

There are four groups. None of them is “this Onshape user, all documents they will ever own.”

### 1. Application Group

- Event: `onshape.user.lifecycle.updateappsettings` — “Occurs when user application settings are modified”
- Registration requires `clientId` (OAuth app id), not a CAD document.

Payload from the docs:

```json
{
  "clientId": "000000000000000000000000",
  "events": ["onshape.user.lifecycle.updateappsettings"],
  "options": { "collapseEvents": false },
  "url": "https://sampleUrl.org"
}
```

This does **not** fire when someone creates a Part Studio. Useless for discovery.

### 2. Document Group (this is the one we already use per `documentId`)

Exact event names from the docs:

| Event | Meaning |
|---|---|
| `onshape.comment.create` | Comment created |
| `onshape.comment.delete` | Comment deleted |
| `onshape.comment.update` | Comment updated |
| `onshape.document.lifecycle.created` | **Document is created** |
| `onshape.document.lifecycle.shared` | Share created/modified/removed via Share dialog |
| `onshape.document.lifecycle.statechange` | Document state change (`ACTIVE` / `TRASH` / `DELETED`) — **documentId only** |
| `onshape.model.lifecycle.changed` | Model change (what we register today) |
| `onshape.model.lifecycle.changed.externalreferences` | External reference change |
| `onshape.model.lifecycle.createelement` | New element |
| `onshape.model.lifecycle.createversion` | New version |
| `onshape.model.lifecycle.createworkspace` | New workspace |
| `onshape.model.lifecycle.deleteelement` | Element deleted |
| `onshape.model.lifecycle.metadata` | Part/element metadata |
| `onshape.model.translation.complete` | Translation finished |
| `onshape.revision.created` | Revision created |

Registration requirements, quoted:

> `documentId` OR `companyId` must be specified in the registration body
>
> Only `documentId` is valid for the `onshape.document.lifecycle.statechange`

Document-scoped payload (docs example; their sample `events` array is a copy-paste of the application event — real use is a document event):

```json
{
  "documentId": "000000000000000000000000",
  "events": ["onshape.model.lifecycle.createversion"],
  "options": { "collapseEvents": false },
  "url": "https://sampleUrl.org"
}
```

Company-scoped equivalent (same group, `companyId` instead of `documentId`):

```json
{
  "companyId": "YOUR_COMPANY_ID",
  "events": ["onshape.document.lifecycle.created"],
  "options": { "collapseEvents": false },
  "url": "https://example.com/api/webhooks/onshape"
}
```

`isTransient` should be `false` so Onshape does not garbage-collect the hook (same note already in our client).

### 3. Workflow Group

- Event: `onshape.workflow.transition`
- **Requires `companyId`.** Release-management, not personal CAD docs.

### 4. Lifecycle Group (automatic)

`webhook.register`, `webhook.unregister`, `webhook.ping` — sent for hooks you already created. You do not register these yourself.

---

## Is there a USER scope?

**Not in the Event Groups table.**

`BTWebhookParams` in the OpenAPI schema does include a `userId` field, with **no description**. The documented createWebhook body for document events still requires `documentId` **or** `companyId`. I am not treating an undocumented field as a working “watch all my future documents” API.

`GET /api/v6/webhooks?user={uid}` is a **list** filter:

```
GET https://cad.onshape.com/api/v6/webhooks?user={uid}&offset=0&limit=20
```

OpenAPI also has `filter` on create (forum-era form `{$UserId} = 'UID' && {$ClientId} = 'CID'`). The public Event Groups page does not say that filter replaces `documentId`/`companyId`. I did not assume it does.

---

## Account tier / free / EDU

OpenAPI on `companyId`:

> Company admins can register webhooks to listen to all company events.

Help page [Company/Classroom/Enterprise Settings — Webhooks](https://cad.onshape.com/help/Content/Plans/enterprise_settings_webhooks.htm) is **admin** settings (signature keys, basic auth on deliveries). It is not a user-level “new document” subscription, and it lives under Company / Classroom / Enterprise — not a personal free account’s document list.

The public guide does **not** say a free or EDU **personal** account can register `companyId` document webhooks covering every document that user will create. Classroom/company webhooks, if they exist at all on EDU, are for **company-owned** documents under an admin’s `companyId`, not for a student’s or hobbyist’s privately owned docs.

Default for this project: **treat company scope as unavailable** on the bound EDU/free personal account. If that account is actually a classroom admin with a real `companyId`, that would be a new fact — see QUESTIONS.md.

---

## If company scope existed and we could use it

That would make **new-document discovery free forever** (deliveries do not count against the 2,500/year quota). Implementing it would mean:

1. Confirm a `companyId` this user admins (one `GET` — do not spend that call until asked).
2. `POST /api/v6/webhooks` with `companyId` + `onshape.document.lifecycle.created` (and the model events we already listen for, so first edit on a brand-new doc is covered without a later per-doc register).
3. Change `/api/webhooks/onshape` to accept an unknown `documentId`, insert `tracked_documents`, first-history backfill, then optionally register a per-doc hook or keep relying on the company hook.
4. Keep the activity-driven list cron as a backstop until that path is proven.

**Do not implement this until the account is confirmed to be a company admin.** On a personal EDU login it will 4xx and we will have spent a call to learn nothing the docs did not already say.

---

## What we keep doing

Per-`documentId` webhooks after we learn the id, plus activity-driven daily/weekly `listMyDocuments` for users who already model, plus discovery-on-connect for brand-new users.
