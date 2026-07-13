export type Language = "en" | "zh";

export type University = {
  rank2027: string;
  rank2026: string;
  region: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  tuition: {
    amount: number | null;
    currency: string;
    label: string;
    assumption: string;
  };
  logoPath: string;
  logoSource: string;
  logoProfileSource: string;
  qsSource: string;
  officialWebsite: string;
  coordinateSource: string;
};

export type HoverState =
  | {
      type: "university";
      university: University;
      x: number;
      y: number;
    }
  | {
      type: "cluster";
      universities: University[];
      x: number;
      y: number;
    }
  | null;
