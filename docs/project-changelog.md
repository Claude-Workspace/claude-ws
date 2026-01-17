# Project Changelog

## [2026-01-17]

### Added
- **Git Graph Visualization**: Implemented a VSCode-style git graph in the sidebar.
  - Added `isLocal` flag to git log API to distinguish between local and remote-pushed commits.
  - Implemented lane calculation logic for topological branch visualization.
  - Added SVG path generation for smooth branch connections.
  - Added deterministic branch coloring based on branch names.
- **Git Remote Operations**: Added Fetch, Pull, and Push buttons to the Git Graph header.

### Changed
- **UI Refinements**:
  - Reduced filename font size to `text-xs` in git changes and graph.
  - Made scrollbars thinner and more transparent.
  - Redesigned "Generate Commit Message" button to be icon-only for better space efficiency.
  - Adjusted Git Panel button widths: Commit (60%), Generate (40%).

### Fixed
- Improved reference parsing to handle remote branch naming (e.g., `origin/main`).
