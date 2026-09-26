# ResQGrid — Canonical Data Models

All services and UI components must use these models exactly.
Do not add fields without updating this file first.

---

## ID Formats

| Entity | Format | Example | Generation rule |
|--------|--------|---------|-----------------|
| Incident | `INC-` + 4-digit zero-padded integer | `INC-0001` | Find max existing numeric suffix, increment by 1 |
| Resource | `RES-` + 4-digit zero-padded integer | `RES-0042` | Find max existing numeric suffix, increment by 1 |
| Assistant Log | `LOG-` + 4-digit zero-padded integer | `LOG-0007` | Find max existing numeric suffix, increment by 1 |

IDs are assigned at creation time and are **immutable**. Never allow the user to edit an ID.

---

## Allowed Enum Values

### Incident Type
```
Fire | Medical | Security | Hazmat | Natural Disaster | Other
```

### Incident Priority
```
Critical | High | Medium | Low
```
Priority ordering (highest → lowest): `Critical > High > Medium > Low`

### Incident Status
```
Reported | Active | In Progress | Resolved
```
Valid status transitions:
- `Reported` → `Active`
- `Active` → `In Progress`
- `In Progress` → `Resolved`
- `Resolved` is a terminal state. No further transitions allowed.

### Resource Type
```
Ambulance | Fire Truck | Police Unit | Hazmat Team | Medical Team | Utility Crew | Other
```

### Resource Status
```
Available | Deployed | Maintenance
```
- `Available` → `Deployed` (when assigned to an incident)
- `Deployed` → `Available` (when incident is resolved or resource is manually released)
- Any status → `Maintenance` (manually set by coordinator)
- `Maintenance` → `Available` (manually cleared by coordinator)
- A resource in `Deployed` or `Maintenance` status **cannot** be assigned to a new incident.

### Assistant Confidence
```
High | Medium | Low
```

---

## Incident Model

**LocalStorage key:** `resqgrid_incidents`
**Storage type:** JSON array of Incident objects

```json
{
  "id": "INC-0001",
  "title": "Smoke detected in Building A",
  "description": "Thick smoke visible from second floor stairwell. No flames observed.",
  "type": "Fire",
  "priority": "High",
  "status": "Active",
  "location": "Building A, Floor 2",
  "reportedBy": "Jane Coordinator",
  "reportedAt": "2024-03-15T09:30:00.000Z",
  "updatedAt": "2024-03-15T09:35:00.000Z",
  "resolvedAt": null,
  "assignedResources": ["RES-0001", "RES-0003"],
  "notes": "Fire alarm triggered. Evacuation in progress."
}
```

### Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Auto-generated. Immutable. |
| `title` | string | Yes | 5–100 characters. |
| `description` | string | Yes | 10–500 characters. |
| `type` | enum | Yes | Must match Incident Type enum. |
| `priority` | enum | Yes | Must match Incident Priority enum. |
| `status` | enum | Yes | Defaults to `"Reported"` on creation. |
| `location` | string | Yes | Building/room name. Not GPS coordinates. |
| `reportedBy` | string | Yes | Free-text name of the coordinator reporting. |
| `reportedAt` | string | Yes | ISO 8601 UTC timestamp. Set on creation. Immutable. |
| `updatedAt` | string | Yes | ISO 8601 UTC timestamp. Updated on every change. |
| `resolvedAt` | string\|null | Yes | ISO 8601 UTC timestamp when status set to `Resolved`. Otherwise `null`. |
| `assignedResources` | string[] | Yes | Array of Resource IDs. Empty array `[]` if none assigned. |
| `notes` | string | No | Free-text coordinator notes. May be empty string `""`. |

---

## Resource Model

**LocalStorage key:** `resqgrid_resources`
**Storage type:** JSON array of Resource objects

```json
{
  "id": "RES-0001",
  "name": "Ambulance Unit 1",
  "type": "Ambulance",
  "status": "Deployed",
  "location": "Main Campus Gate",
  "assignedTo": "INC-0001",
  "addedAt": "2024-03-01T08:00:00.000Z"
}
```

### Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Auto-generated. Immutable. |
| `name` | string | Yes | Must be unique across all resources. |
| `type` | enum | Yes | Must match Resource Type enum. |
| `status` | enum | Yes | Defaults to `"Available"` on creation. |
| `location` | string | Yes | Current base location of the resource. |
| `assignedTo` | string\|null | Yes | Incident ID if `Deployed`. Otherwise `null`. |
| `addedAt` | string | Yes | ISO 8601 UTC timestamp. Set on creation. Immutable. |

---

## Derived Statistics

Statistics are **never stored** in LocalStorage. They are computed on demand from the incidents and resources arrays.

| Metric | Computation |
|--------|-------------|
| Total active incidents | Count of incidents where `status !== "Resolved"` |
| Total resolved incidents | Count of incidents where `status === "Resolved"` |
| Incidents by type | Group incidents by `type`, count each group |
| Incidents by priority | Group incidents by `priority`, count each group |
| Incidents by status | Group incidents by `status`, count each group |
| Total resources | Count of all resource records |
| Resources available | Count where `status === "Available"` |
| Resources deployed | Count where `status === "Deployed"` |
| Resources in maintenance | Count where `status === "Maintenance"` |
| Average resolution time | Mean of `(resolvedAt - reportedAt)` in minutes, for resolved incidents only |
| Fastest resolution time | Min of `(resolvedAt - reportedAt)` in minutes |
| Slowest resolution time | Max of `(resolvedAt - reportedAt)` in minutes |

If there are zero resolved incidents, resolution time metrics must return `null` and display as "N/A".

---

## Assistant Log Model

**LocalStorage key:** `resqgrid_assistant_log`
**Storage type:** JSON array of AssistantLog objects
**Purpose:** Records each use of the Decision-Support Assistant for transparency and review.

```json
{
  "id": "LOG-0001",
  "inputDescription": "Person collapsed near cafeteria, not responding",
  "suggestedType": "Medical",
  "suggestedPriority": "Critical",
  "suggestedResources": ["Ambulance", "Medical Team"],
  "confidence": "High",
  "matchedKeywords": ["collapsed", "not responding"],
  "accepted": true,
  "timestamp": "2024-03-15T10:15:00.000Z"
}
```

### Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Auto-generated. Immutable. |
| `inputDescription` | string | Yes | The raw text the coordinator entered. |
| `suggestedType` | string | Yes | Suggested Incident Type enum value. |
| `suggestedPriority` | string | Yes | Suggested Incident Priority enum value. |
| `suggestedResources` | string[] | Yes | Array of Resource Type strings (not IDs). |
| `confidence` | enum | Yes | `"High"` / `"Medium"` / `"Low"`. |
| `matchedKeywords` | string[] | Yes | Keywords that triggered the classification rules. |
| `accepted` | boolean | Yes | `true` if coordinator used the suggestion; `false` if dismissed. |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp. |

---

## Relationships

```
Incident  (1) ────── (0..n)  Resource
           assignedResources[]  ←→  assignedTo
```

- An Incident has zero or more Resources assigned to it (`assignedResources: string[]`).
- A Resource is assigned to at most one Incident at a time (`assignedTo: string | null`).
- These two fields are the **source of truth for the assignment relationship** and must always be kept in sync:
  - When assigning Resource `RES-0001` to Incident `INC-0002`:
    1. Add `"RES-0001"` to `incident.assignedResources`
    2. Set `resource.assignedTo = "INC-0002"`
    3. Set `resource.status = "Deployed"`
  - When releasing Resource `RES-0001` from Incident `INC-0002`:
    1. Remove `"RES-0001"` from `incident.assignedResources`
    2. Set `resource.assignedTo = null`
    3. Set `resource.status = "Available"`
  - When an Incident is resolved:
    1. Set `incident.status = "Resolved"` and `incident.resolvedAt = <now>`
    2. Release **all** resources in `incident.assignedResources` using the steps above
    3. Clear `incident.assignedResources = []`

**Orphan prevention:** If a resource references an incident ID that no longer exists, reset `resource.assignedTo = null` and `resource.status = "Available"` on store load.
