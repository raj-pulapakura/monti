## MODIFIED Requirements

### Requirement: Publish launch pricing on public Monti surfaces
The web application SHALL present Monti's launch pricing story on public, unauthenticated surfaces. At minimum, the unauthenticated root landing experience and a dedicated shareable `/pricing` route MUST describe the free allowance, paid allowance, `fast` and `quality` credit costs, top-up availability for paid users, and the no-automatic-overage launch posture. The landing page pricing section header SHALL use low-friction copy (e.g. "Start free. Upgrade when you're ready.") rather than classroom-specific framing.

#### Scenario: Anonymous visitor sees pricing on the landing surface
- **WHEN** an unauthenticated visitor opens the root marketing experience
- **THEN** the page includes a visible pricing section that summarizes Monti's launch plans and credit model with a header that emphasizes free-start and low commitment

#### Scenario: Anonymous visitor opens the dedicated pricing route
- **WHEN** an unauthenticated visitor requests `/pricing`
- **THEN** the system renders a public pricing page without requiring authentication

#### Scenario: Pricing section header uses educator-inclusive language
- **WHEN** the landing page pricing section renders
- **THEN** the section header does not contain the word "classroom" and instead uses language welcoming to all educator types
