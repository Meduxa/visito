// Visito's own company details, shown on the main page and the legal pages
// (payment providers such as Flitt require them on the website). Fill in when
// the company is registered; an empty value is simply not shown.
export const COMPANY: {
  legalName: string;
  idCode: string;
  address: string;
  phone: string;
  email: string;
} = {
  legalName: "", // e.g. "შპს ვიზიტო" / "ი/მ ლევან მედოშვილი"
  idCode: "", // identification code
  address: "", // legal address
  phone: "", // public phone, E.164, e.g. "+995 5XX XX XX XX"
  email: "", // public email for customers
};

export const hasCompanyDetails = () => Object.values(COMPANY).some(Boolean);
