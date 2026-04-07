## MODIFIED Requirements

### Requirement: Provide snapshot retrieval for reconnect and refresh
The system SHALL provide a snapshot API that returns current sandbox state and render payload references for hydration after reconnect. When an active experience is present, the snapshot SHALL include the experience slug to enable client-side share affordances.

#### Scenario: Client reconnects after disconnect
- **WHEN** the client rehydrates a thread after losing event stream connection
- **THEN** the system returns the latest sandbox state so UI can reconcile without replaying full history

#### Scenario: Snapshot includes slug when experience has one
- **WHEN** the sandbox preview is fetched and the active experience has a non-null slug
- **THEN** the `activeExperience` payload in the response includes `slug: string`

#### Scenario: Snapshot includes null slug when experience predates sharing
- **WHEN** the sandbox preview is fetched and the active experience was created before slug generation was introduced
- **THEN** the `activeExperience` payload includes `slug: null`
