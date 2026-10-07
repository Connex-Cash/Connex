/** The time a request is rendered at. Kept in one place so server pages share one clock reading per render. */
export const requestNow = () => Date.now();
