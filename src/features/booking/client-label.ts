// The words for a visit without a visible client: a walk-in, or a client this
// person may not see (staff who see only their own clients; test plan #43).
export const noClientKey = (b: { clientHidden?: boolean }) =>
  b.clientHidden ? ("calendar.hiddenClient" as const) : ("calendar.walkIn" as const);
