// Where 跳到正文 lands. `main-content` is the layout's <main>, present on every
// page; `workspace-content` is the workspace shell's content column, which sits
// after the workspace rail — skipping only the top nav would still leave a
// keyboard user a dozen rail links away from the page.
//
// A plain module rather than exports of the "use client" skip link, because
// the layout and the workspace shell are server components: a constant
// imported from a client module reaches them as a client reference, not a
// string.
export const mainContentId = "main-content";
export const workspaceContentId = "workspace-content";
