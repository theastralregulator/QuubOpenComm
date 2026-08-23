/**
 * Site contact & legal details configuration.
 * All fields are optional and will only render in the UI when populated by the platform owner.
 */
export interface SiteContactConfig {
  supportEmail?: string;
  grievanceOfficerName?: string;
  corporateAddress?: string;
  supportPhone?: string;
}

export const siteContactConfig: SiteContactConfig = {
  // Configured values (optional until supplied by owner)
  supportEmail: undefined,
  grievanceOfficerName: undefined,
  corporateAddress: undefined,
  supportPhone: undefined,
};
