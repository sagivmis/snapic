export type AppTab = "portrait" | "gallery" | "results";

export interface NavItem {
  id: AppTab;
  label: string;
  description: string;
  step: number;
}

const NAV_STRUCTURE: { id: AppTab; step: number }[] = [
  { id: "portrait", step: 1 },
  { id: "gallery", step: 2 },
  { id: "results", step: 3 },
];

export function getNavItems(tPath: (key: string) => string): NavItem[] {
  return NAV_STRUCTURE.map(({ id, step }) => ({
    id,
    step,
    label: tPath(`${id}.label`),
    description: tPath(`${id}.description`),
  }));
}
