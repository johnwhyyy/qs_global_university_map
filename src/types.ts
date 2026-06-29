export type University = {
  rank: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  tuition: {
    amount: number;
    currency: string;
    label: string;
    assumption: string;
  };
  logoPath: string;
  logoSource: string;
  logoProfileSource: string;
  qsSource: string;
  tuitionSource: string;
  coordinateSource: string;
};

export type HoverState = {
  university: University;
  x: number;
  y: number;
} | null;
