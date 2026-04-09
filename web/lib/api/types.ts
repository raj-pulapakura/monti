export type RedirectResponse = {
  ok: true;
  data: {
    url?: string;
    checkoutUrl?: string;
    portalUrl?: string;
  };
};
