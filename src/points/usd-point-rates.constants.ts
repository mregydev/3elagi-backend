/** USD value of one consultation credit by market. */
export const USD_PER_POINT = {
  EG: 2,
  JO: 15,
  INTL: 50,
} as const;

export type UsdPointMarket = keyof typeof USD_PER_POINT;
