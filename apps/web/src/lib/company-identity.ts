type CompanyIdentityInput = {
  company_slug?: string | null;
  company_name?: string | null;
};

export function stableCompanyIdentity(
  company: CompanyIdentityInput | undefined,
  fallbackName = "",
) {
  const slug = company?.company_slug?.trim().toLocaleLowerCase("en-US");
  if (slug) return `slug:${slug}`;

  const name = (company?.company_name || fallbackName)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
  return `name:${name}`;
}
